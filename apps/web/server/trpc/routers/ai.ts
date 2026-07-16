import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../init";
import {
  listObservations,
  users,
  insights,
  medications,
  conditions,
  encounters,
} from "@openvitals/database";
import {
  healthChatPrompt,
  formatObservationForContext,
  buildContextSummary,
  estimateTokens,
  getModel,
} from "@openvitals/ai";
import type { ContextBundle } from "@openvitals/ai";
import { generateText } from "ai";

export const aiRouter = createRouter({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        categories: z.array(z.string()).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        conversationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Build context from user's observations
      const obs = await listObservations(ctx.db, {
        userId: ctx.userId,
        category: input.categories?.[0],
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: 100,
      });

      // Fetch medications, conditions, and encounters for richer context
      const [meds, conds, encs] = await Promise.all([
        ctx.db
          .select({
            name: medications.name,
            dosage: medications.dosage,
            frequency: medications.frequency,
            isActive: medications.isActive,
            startDate: medications.startDate,
            category: medications.category,
          })
          .from(medications)
          .where(eq(medications.userId, ctx.userId))
          .orderBy(desc(medications.createdAt))
          .limit(20),
        ctx.db
          .select({
            name: conditions.name,
            severity: conditions.severity,
            status: conditions.status,
            onsetDate: conditions.onsetDate,
          })
          .from(conditions)
          .where(eq(conditions.userId, ctx.userId))
          .limit(20),
        ctx.db
          .select({
            type: encounters.type,
            provider: encounters.provider,
            encounterDate: encounters.encounterDate,
            chiefComplaint: encounters.chiefComplaint,
            summary: encounters.summary,
          })
          .from(encounters)
          .where(eq(encounters.userId, ctx.userId))
          .orderBy(desc(encounters.encounterDate))
          .limit(10),
      ]);

      const formattedObs = obs.map(formatObservationForContext);

      // Build medication context
      const medsContext =
        meds.length > 0
          ? "\n--- MEDICATIONS ---\n" +
            meds
              .map(
                (m) =>
                  `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` (${m.frequency})` : ""} - ${m.isActive ? "Active" : "Discontinued"}${m.startDate ? ` since ${m.startDate}` : ""}`,
              )
              .join("\n")
          : "";

      // Build conditions context
      const condsContext =
        conds.length > 0
          ? "\n--- CONDITIONS ---\n" +
            conds
              .map(
                (c) =>
                  `${c.name}${c.severity ? ` (${c.severity})` : ""} - ${c.status ?? "active"}${c.onsetDate ? ` since ${c.onsetDate}` : ""}`,
              )
              .join("\n")
          : "";

      // Build encounters context
      const encsContext =
        encs.length > 0
          ? "\n--- RECENT ENCOUNTERS ---\n" +
            encs
              .map(
                (e) =>
                  `${e.type.replace(/_/g, " ")} on ${e.encounterDate}${e.provider ? ` with ${e.provider}` : ""}${e.chiefComplaint ? `: ${e.chiefComplaint}` : ""}${e.summary ? ` — ${e.summary}` : ""}`,
              )
              .join("\n")
          : "";

      const contextText =
        formattedObs.join("\n") + medsContext + condsContext + encsContext;

      const bundle: ContextBundle = {
        sections: (input.categories ?? ["general"]).map((cat) => ({
          category: cat as any,
          content: contextText,
          observationIds: obs.map((o) => o.id),
          tokenEstimate: estimateTokens(contextText),
        })),
        totalTokenEstimate: estimateTokens(contextText),
        observationCount: obs.length,
        sourceObservationIds: obs.map((o) => o.id),
        categories: (input.categories ?? []) as any[],
        assembledAt: new Date(),
        summary: "",
      };

      bundle.summary = buildContextSummary(bundle);

      // Get user's preferred AI model
      const [user] = await ctx.db
        .select({ aiModel: users.aiModel })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      const modelId =
        user?.aiModel ??
        process.env.AI_DEFAULT_MODEL ??
        "claude-sonnet-4-20250514";

      const { text: answer } = await generateText({
        model: getModel(modelId),
        system: `${healthChatPrompt}\n\n--- USER HEALTH DATA ---\n${bundle.summary}\n${contextText}`,
        prompt: input.message,
      });

      // Store insight
      const [insight] = await ctx.db
        .insert(insights)
        .values({
          userId: ctx.userId,
          type: "chat_response",
          content: answer,
          generatedBy: modelId,
          sourceObservationIds: bundle.sourceObservationIds,
          sourceCategories: bundle.categories,
          contextTokenCount: bundle.totalTokenEstimate,
        })
        .returning();

      return {
        answer,
        insightId: insight!.id,
        bundle: bundle.summary,
      };
    }),
});

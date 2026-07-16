import { anthropic } from "@ai-sdk/anthropic";

// Прямой доступ к Anthropic по ANTHROPIC_API_KEY (без Vercel AI Gateway).
// На self-host у нас нет AI_GATEWAY_API_KEY, поэтому ходим в провайдера напрямую.
// anthropic() читает ANTHROPIC_API_KEY из env во время запроса.
export function getModel(modelId?: string) {
  const id =
    modelId ?? process.env.AI_DEFAULT_MODEL ?? "claude-sonnet-4-20250514";
  // Имя модели должно быть без префикса "anthropic/" (это формат шлюза).
  return anthropic(id.replace(/^anthropic\//, ""));
}

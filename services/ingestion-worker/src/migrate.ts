// Применение миграций Drizzle к БД.
// tsup собирает это в самодостаточный dist/migrate.js (noExternal бандлит pg и
// drizzle-orm внутрь). Бандл + сами SQL-миграции копируются в web-образ и
// запускаются перед стартом Next-сервера — схема накатывается автоматически.
//
// db-хендл берём из @openvitals/database (прямой зависимости воркера), а не
// импортируем pg напрямую — pg не является зависимостью воркера и не резолвится.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "@openvitals/database";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  // По умолчанию SQL-миграции лежат в папке ./drizzle рядом с этим бандлом
  // (так их кладёт Dockerfile.web). Можно переопределить через MIGRATIONS_DIR.
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "drizzle");

  const db = getDb();

  console.log(`Applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log("✅ Migrations applied");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });

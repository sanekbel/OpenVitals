// Применение миграций Drizzle к БД.
// tsup собирает это в самодостаточный dist/migrate.js (noExternal бандлит pg и
// drizzle-orm внутрь). Бандл + сами SQL-миграции копируются в web-образ и
// запускаются перед стартом Next-сервера — схема накатывается автоматически.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // По умолчанию SQL-миграции лежат в папке ./drizzle рядом с этим бандлом
  // (так их кладёт Dockerfile.web). Можно переопределить через MIGRATIONS_DIR.
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "drizzle");

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log(`Applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log("✅ Migrations applied");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

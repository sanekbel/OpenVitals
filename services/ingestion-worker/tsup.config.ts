import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/migrate.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  bundle: true,
  // Без code splitting: каждый entry (server.js, migrate.js) — самодостаточный
  // файл без общих chunk-*.js. migrate.js копируется в web-образ поодиночке.
  splitting: false,
  noExternal: [/^(?!(pdfjs-dist|@napi-rs\/canvas)).*$/],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});

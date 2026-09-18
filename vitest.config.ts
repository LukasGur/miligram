import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /**
     * Testy běží v pásmu, ve kterém aplikaci používají její uživatelé.
     * Den se počítá podle kalendáře uživatele, ne podle UTC, a v UTC by
     * se rozdíl mezi obojím neprojevil — chyba by testy prošla.
     */
    env: { TZ: "Europe/Prague" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});

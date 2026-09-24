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
    /**
     * Testy běží i při buildu na Cloudflare Pages, a tamní stroj je
     * zhruba pětkrát pomalejší než vývojový. Sazba všech vzorců všech
     * šablon v obou jazycích tam přetekla výchozích 5 s a shodila nasazení,
     * i když byla v pořádku. Build má padat kvůli chybě, ne kvůli rychlosti.
     */
    testTimeout: 60_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});

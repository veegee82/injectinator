import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error plain ESM script without types
import liveCorpus from "./scripts/live-corpus-plugin.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.INJECTINATOR_ROOT ?? join(here, ".."));

export default defineConfig({ plugins: [react(), liveCorpus({ root })], base: "./", server: { host: "127.0.0.1" } });

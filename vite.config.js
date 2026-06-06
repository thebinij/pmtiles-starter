import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { pmtilesByteServing } from "./vite-plugin-pmtiles.js";

export default defineConfig({
  appType: "spa",
  plugins: [svelte(), pmtilesByteServing()],
});

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const bucket = process.env.R2_BUCKET ?? "worldmap-tiles";

const tiles = ["world.pmtiles", "nepal.pmtiles", "india.pmtiles"];

console.log(`Uploading tiles to R2 bucket: ${bucket}`);

for (const file of tiles) {
  const filePath = path.join(publicDir, file);
  console.log(`  → ${bucket}/${file}`);
  execSync(
    `npx wrangler r2 object put "${bucket}/${file}" --file="${filePath}" --remote`,
    { stdio: "inherit" },
  );
}

console.log("Done.");

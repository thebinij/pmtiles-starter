import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function log(message) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${message}`);
}

function run(command, args) {
  log(`tippecanoe ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function report(file) {
  const { size } = fs.statSync(path.join(publicDir, file));
  log(`  → public/${file} (${(size / (1024 * 1024)).toFixed(2)} MB)`);
}

const builds = [
  {
    label: "world.pmtiles (countries)",
    args: [
      "-o", "public/world.pmtiles",
      "--force",
      "--read-parallel",
      "--layer=boundaries",
      "--generate-ids",
      "geojsons/world.geojson",
      "-z5", "-Z0", "-S10",
      "--coalesce-densest-as-needed",
    ],
  },
  {
    label: "nepal.pmtiles (provinces + districts + local)",
    args: [
      "-o", "public/nepal.pmtiles",
      "--force",
      "--read-parallel",
      "--named-layer=provinces:geojsons/nepal.geojson",
      "--named-layer=districts:geojsons/nepal-districts.geojson",
      "--named-layer=locallevels:geojsons/nepal-local.geojson",
      "-z12", "-Z3", "-S10",
      "--generate-ids",
      "--coalesce-densest-as-needed",
      "--drop-densest-as-needed",
    ],
  },
  {
    label: "usa.pmtiles (states + counties)",
    args: [
      "-o", "public/usa.pmtiles",
      "--force",
      "--read-parallel",
      "--named-layer=states:geojsons/usa-states.geojson",
      "--named-layer=counties:geojsons/usa-counties.geojson",
      "-z10", "-Z1", "-S10",
      "--generate-ids",
      "--use-attribute-for-id=GEOID:counties",
      "--coalesce-densest-as-needed",
      "--drop-densest-as-needed",
    ],
  },
  {
    label: "india.pmtiles (states)",
    args: [
      "-o", "public/india.pmtiles",
      "--force",
      "--read-parallel",
      "--layer=states",
      "--generate-ids",
      "geojsons/india_state.geojson",
      "-z7", "-Z3", "-S10",
      "--coalesce-densest-as-needed",
    ],
  },
];

log("1/2: simplify india GeoJSON");
run("npx", [
  "--yes", "mapshaper",
  "-i", "geojsons/india_state_full.geojson",
  "-simplify", "dp", "5%", "keep-shapes",
  "-o", "geojsons/india_state.geojson",
]);

log("2/3: world label points");
run("node", ["scripts/build-world-labels.mjs"]);

log("3/3: tippecanoe");
for (const [index, build] of builds.entries()) {
  log(`${index + 1}/${builds.length}: ${build.label}`);
  run("tippecanoe", build.args);
  report(path.basename(build.args[1]));
}

log("done");

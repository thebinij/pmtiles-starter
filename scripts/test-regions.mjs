import {
  boundsIntersect,
  regionsRankedInView,
  regionsInView,
  DETAIL_REGIONS,
} from "../src/lib/mapConfig.js";

const easternNepalView = [
  [87.5, 26.5],
  [89.0, 28.5],
];
const kathmanduView = [
  [84.5, 27.0],
  [86.0, 28.5],
];
const delhiView = [
  [76.5, 27.5],
  [78.0, 29.0],
];
const usaView = [
  [-110, 35],
  [-90, 45],
];
const puertoRicoView = [
  [-67.5, 17.8],
  [-65.5, 18.6],
];
const europeView = [
  [-5, 45],
  [15, 55],
];

function includesAll(got, expected) {
  return expected.every((code) => got.includes(code));
}

const cases = [
  ["Kathmandu viewport z5 (below province min)", 85.32, 27.72, 5, kathmanduView, []],
  ["Kathmandu viewport z5.5", 85.32, 27.72, 5.5, kathmanduView, ["NPL"]],
  ["Eastern Nepal viewport z6", 87.8, 27.2, 6, easternNepalView, ["NPL"]],
  ["Delhi viewport z5", 77.2, 28.6, 5, delhiView, ["IND"]],
  ["Delhi viewport z3", 77.2, 28.6, 3, delhiView, ["IND"]],
  ["Delhi viewport z4", 77.2, 28.6, 4, delhiView, ["IND"]],
  ["Delhi viewport z6", 77.2, 28.6, 6, delhiView, ["IND"]],
  ["USA viewport z2 (below state min)", -100, 40, 2, usaView, []],
  ["USA viewport z2.5", -100, 40, 2.5, usaView, ["USA"]],
  ["Puerto Rico viewport z2.5", -66.1, 18.2, 2.5, puertoRicoView, ["USA"]],
  ["Europe viewport z5", 10, 50, 5, europeView, []],
];

let failed = 0;

for (const [name, lng, lat, zoom, view, expected] of cases) {
  const got = regionsInView(lng, lat, zoom, view);
  const ok = includesAll(got, expected);
  if (!ok) failed += 1;
  console.log(`${ok ? "OK" : "FAIL"} ${name}:`, got, "expected at least", expected);
}

const indiaAtZ4 = regionsInView(77.2, 28.6, 4, delhiView);
const indiaStaysAtZ4 = indiaAtZ4.includes("IND");
console.log(
  `${indiaStaysAtZ4 ? "OK" : "FAIL"} India in view at z4 over Delhi:`,
  indiaAtZ4,
);
if (!indiaStaysAtZ4) failed += 1;

const noNplBelowMin = !regionsInView(85, 28, 3.9, kathmanduView).includes("NPL");
console.log(`${noNplBelowMin ? "OK" : "FAIL"} Nepal below min zoom (no NPL at z3.9)`);
if (!noNplBelowMin) failed += 1;

const europeEmpty = regionsInView(10, 50, 5, europeView).length === 0;
console.log(`${europeEmpty ? "OK" : "FAIL"} Europe viewport has no detail regions`);
if (!europeEmpty) failed += 1;

if (!boundsIntersect(easternNepalView, DETAIL_REGIONS.NPL.bounds)) {
  failed += 1;
  console.log("FAIL eastern Nepal viewport should intersect Nepal bounds");
}

const wideView = [
  [-120, 15],
  [100, 45],
];
const wideInViewZ5 = regionsInView(0, 30, 5, wideView);
const wideZ5Ok = wideInViewZ5.includes("USA") && wideInViewZ5.includes("IND");
console.log(
  `${wideZ5Ok ? "OK" : "FAIL"} wide z5 keeps USA and India (Nepal needs z5.5+):`,
  wideInViewZ5,
);
if (!wideZ5Ok) failed += 1;

const wideInView = regionsInView(0, 30, 6, wideView);
const wideOk =
  wideInView.includes("USA") &&
  wideInView.includes("NPL") &&
  wideInView.includes("IND");
console.log(`${wideOk ? "OK" : "FAIL"} wide z6 keeps all intersecting countries:`, wideInView);
if (!wideOk) failed += 1;

const ranked = regionsRankedInView(77.2, 28.6, 5, delhiView);
const delhiRankOk = ranked[0]?.code === "IND";
console.log(
  `${delhiRankOk ? "OK" : "FAIL"} Delhi ranks India closest:`,
  ranked.map((entry) => entry.code),
);
if (!delhiRankOk) failed += 1;

process.exit(failed ? 1 : 0);

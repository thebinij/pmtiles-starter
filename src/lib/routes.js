/** @typedef {'geojson' | 'pmtiles'} MapFormat */

export const FORMAT_PATHS = {
  geojson: "/geojson",
  pmtiles: "/pmtiles",
};

export function tabFromPath(pathname) {
  if (pathname === "/pmtiles" || pathname.startsWith("/pmtiles/")) {
    return "pmtiles";
  }
  if (pathname === "/geojson" || pathname.startsWith("/geojson/")) {
    return "geojson";
  }
  return "geojson";
}

export function pathFromTab(tab) {
  return FORMAT_PATHS[tab] ?? FORMAT_PATHS.geojson;
}

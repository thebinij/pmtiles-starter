/** @typedef {'geojson' | 'pmtiles'} MapFormat */

/** @typedef {{ format: MapFormat, networkBytes: number, heapBytes: number | null, heapAvailable: boolean, filesLoaded: number, estimated: boolean }} MapStats */

/** On-disk sizes — MapLibre fetches GeoJSON inside a Web Worker (invisible to Performance API). */
export const GEOJSON_FILE_SIZES = {
  "/geojsons/world.geojson": 3083490,
  "/geojsons/nepal.geojson": 3021312,
  "/geojsons/nepal-districts.geojson": 1226220,
  "/geojsons/nepal-local.geojson": 3623780,
  "/geojsons/india_state.geojson": 22967643,
};

/**
 * @param {number | null | undefined} bytes
 */
export function formatBytes(bytes) {
  if (bytes == null || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {PerformanceResourceTiming} entry
 */
function entryBytes(entry) {
  return entry.transferSize || entry.decodedBodySize || entry.encodedBodySize || 0;
}

/**
 * @param {MapFormat} format
 */
function resourceMatchesFormat(name, format) {
  if (format === "pmtiles") return name.includes(".pmtiles");
  return false;
}

export function createGeojsonLoadTracker() {
  /** @type {Set<string>} */
  const loaded = new Set();

  return {
    /** @param {{ type?: string, data?: unknown }} source */
    markSource(source) {
      if (source?.type !== "geojson" || typeof source.data !== "string") return;
      loaded.add(source.data);
    },
    stats() {
      let networkBytes = 0;
      for (const url of loaded) {
        networkBytes += GEOJSON_FILE_SIZES[url] ?? 0;
      }
      return { networkBytes, filesLoaded: loaded.size };
    },
  };
}

/**
 * @param {MapFormat} format
 * @param {ReturnType<typeof createGeojsonLoadTracker> | null} [geojsonTracker]
 * @returns {MapStats}
 */
export function collectMapStats(format, geojsonTracker = null) {
  const heapBytes = performance.memory?.usedJSHeapSize ?? null;

  if (format === "geojson" && geojsonTracker) {
    const manual = geojsonTracker.stats();
    return {
      format,
      networkBytes: manual.networkBytes,
      filesLoaded: manual.filesLoaded,
      heapBytes,
      heapAvailable: heapBytes != null,
      estimated: true,
    };
  }

  const resources = performance.getEntriesByType("resource");
  let networkBytes = 0;
  const files = new Set();

  for (const entry of resources) {
    if (!resourceMatchesFormat(entry.name, format)) continue;
    networkBytes += entryBytes(entry);
    files.add(entry.name);
  }

  return {
    format,
    networkBytes,
    filesLoaded: files.size,
    heapBytes,
    heapAvailable: heapBytes != null,
    estimated: false,
  };
}

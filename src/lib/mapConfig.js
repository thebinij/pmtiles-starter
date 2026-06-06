/** Nepal provinces (nepal.geojson) — first detail level */
export const DETAIL_ZOOM = 4;

/** Nepal districts (nepal-districts.geojson) — start fading in */
export const NEPAL_DISTRICT_ZOOM = 5;

/** Nepal districts fully visible */
export const NEPAL_DISTRICT_FULL_ZOOM = 6;

/** Nepal local units (nepal-local.geojson) — start fading in */
export const NEPAL_LOCAL_ZOOM = 7;

/** Nepal local units fully visible */
export const NEPAL_LOCAL_FULL_ZOOM = 8;

/** Bounds [sw, ne] used to fit the full world inside the map panel */
export const WORLD_BOUNDS = [
  [-175, -55],
  [175, 78],
];

export const WORLD_FIT_PADDING = 20;

/** Stay below detail zoom so overlays stay hidden on the world overview */
export const WORLD_MAX_ZOOM = DETAIL_ZOOM - 0.1;

export const FORMAT_META = {
  geojson: {
    label: "GeoJSON",
    tagline: "Simple · cacheable",
    hint: "Easy to host anywhere. Once cached, files load quickly - on deploy you may see GeoJSON feel faster because the browser reuses cached responses with fewer round-trips than many tile requests.",
    bestFor: [
      "Small datasets and quick prototypes",
      "Any static host — no byte-range server setup",
      "Repeat visits when files are browser/CDN cached",
    ],
    notIdealFor: [
      "Large admin boundaries — full download + JSON parse on first load",
      "Zoom and pan — all raw polygons re-render every frame",
      "Scaling to country → state → district level data",
    ],
  },
  pmtiles: {
    label: "PMTiles",
    tagline: "Tiled · scalable",
    hint: "Built for large vector maps. Streams only visible tiles via HTTP range requests - better on first load and at detail zoom, but needs a server that supports byte-range serving.",
    bestFor: [
      "Large datasets split across zoom levels",
      "First visit — fetches only what is on screen",
      "Smooth zoom — pre-simplified tiles per zoom level",
    ],
    notIdealFor: [
      "Requires byte-range HTTP support (Worker + R2, etc.)",
      "Extra build step with tippecanoe",
      "More network requests than one cached GeoJSON file",
    ],
  },
};

export function worldMeta(format) {
  if (format === "geojson") {
    return { sourceLayer: null, promoteId: "ADM0_A3" };
  }
  return { sourceLayer: "boundaries", promoteId: "adm0_a3" };
}

export const DETAIL_MAPS = {
  NPL: {
    source: "nepal",
    fillLayer: "nepal-provinces-fill",
    labelKey: "DISTRICT",
    fallbackLabel: "Province",
    minZoom: DETAIL_ZOOM,
  },
  IND: {
    source: "india",
    fillLayer: "india-states-fill",
    labelKey: "NAME_1",
    fallbackLabel: "State",
    minZoom: DETAIL_ZOOM,
  },
};

export const NEPAL_DISTRICT_MAP = {
  source: "nepal-districts",
  fillLayer: "nepal-districts-fill",
  labelKey: "DISTRICT",
  fallbackLabel: "District",
  minZoom: NEPAL_DISTRICT_ZOOM,
};

export const NEPAL_LOCAL_MAP = {
  source: "nepal-local",
  fillLayer: "nepal-local-fill",
  labelKey: "locallevel_name",
  fallbackLabel: "Local unit",
  minZoom: NEPAL_LOCAL_ZOOM,
};

export function sourceLayerFor(sourceId, format) {
  if (format !== "pmtiles") return null;
  const layers = {
    nepal: "provinces",
    "nepal-districts": "districts",
    "nepal-local": "locallevels",
    india: "districts",
  };
  return layers[sourceId] ?? null;
}

export function countryName(props) {
  return (
    props.formal_en ||
    props.FORMAL_EN ||
    props.name_en ||
    props.NAME ||
    props.name ||
    props.admin ||
    props.ADMIN ||
    props.abbrev ||
    props.ABBREV ||
    "Unknown"
  );
}

export function hasDetailMap(props) {
  const code = props.adm0_a3 || props.ADM0_A3;
  const formal = props.formal_en || props.FORMAL_EN;
  return (
    code === "NPL" ||
    code === "IND" ||
    formal === "Nepal" ||
    formal === "India"
  );
}

export function featureLabel(feature, detail) {
  if (detail.labelKey && feature.properties[detail.labelKey]) {
    return feature.properties[detail.labelKey];
  }
  return detail.fallbackLabel;
}

export function featureStateTarget(source, sourceLayer, id) {
  const target = { source, id };
  if (sourceLayer) target.sourceLayer = sourceLayer;
  return target;
}

/** Fade in between appearZoom and peakZoom; stays visible above (no fade-out). */
function layerFillOpacity(appearZoom, peakZoom, normal, hover) {
  const hoverState = ["boolean", ["feature-state", "hover"], false];
  const faint = ["case", hoverState, hover * 0.35, normal * 0.35];
  const mid = ["case", hoverState, hover * 0.7, normal * 0.7];
  const full = ["case", hoverState, hover, normal];
  const peak = ["case", hoverState, hover * 1.25, normal * 1.25];
  const midZoom = (appearZoom + peakZoom) / 2;
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    appearZoom - 0.25,
    0,
    appearZoom,
    faint,
    midZoom,
    mid,
    peakZoom,
    full,
    peakZoom + 2,
    peak,
  ];
}

function layerLineOpacity(appearZoom, peakZoom, base) {
  const midZoom = (appearZoom + peakZoom) / 2;
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    appearZoom - 0.25,
    0,
    appearZoom,
    base * 0.25,
    midZoom,
    base * 0.6,
    peakZoom,
    base,
    peakZoom + 2,
    base * 1.25,
  ];
}

function detailFillOpacity(minZoom, normal, hover) {
  return layerFillOpacity(minZoom, minZoom + 0.5, normal, hover);
}

function detailLineOpacity(minZoom, base) {
  return layerLineOpacity(minZoom, minZoom + 0.5, base);
}

function vectorLayer(source, sourceLayer, extra = {}) {
  const layer = { source, ...extra };
  if (sourceLayer) layer["source-layer"] = sourceLayer;
  return layer;
}

function worldSource(format) {
  if (format === "geojson") {
    return {
      type: "geojson",
      data: "/geojsons/world.geojson",
      promoteId: "ADM0_A3",
    };
  }
  return {
    type: "vector",
    url: "pmtiles:///world.pmtiles",
    promoteId: "adm0_a3",
  };
}

export function detailSources(format) {
  if (format === "geojson") {
    return {
      nepal: {
        type: "geojson",
        data: "/geojsons/nepal.geojson",
        promoteId: "TARGET",
      },
      india: {
        type: "geojson",
        data: "/geojsons/india_state.geojson",
        promoteId: "ID_1",
      },
    };
  }
  return {
    nepal: {
      type: "vector",
      url: "pmtiles:///nepal.pmtiles",
      promoteId: "TARGET",
    },
    india: {
      type: "vector",
      url: "pmtiles:///india.pmtiles",
      promoteId: "ID_1",
    },
  };
}

function worldLayers(format) {
  const worldSl = format === "pmtiles" ? "boundaries" : null;

  return [
    {
      id: "world-countries-fill",
      type: "fill",
      ...vectorLayer("world", worldSl),
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#60a5fa",
          "transparent",
        ],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.35,
          0.01,
        ],
      },
    },
    {
      id: "world-boundary-glow",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: {
        "line-color": "#94a3b8",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.2,
          4,
          0.4,
          8,
          0.6,
          12,
          1,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DETAIL_ZOOM,
          0.6,
          DETAIL_ZOOM + 1,
          0.15,
        ],
      },
    },
    {
      id: "world-boundary",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: {
        "line-color": "#64748b",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.4,
          4,
          0.6,
          8,
          0.8,
          12,
          1.2,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DETAIL_ZOOM,
          0.6,
          DETAIL_ZOOM + 1,
          0.2,
        ],
      },
    },
  ];
}

function nepalProvinceLayers(format) {
  const sl = sourceLayerFor("nepal", format);
  const appear = DETAIL_ZOOM;
  const peak = DETAIL_ZOOM + 0.5;

  return [
    {
      id: "nepal-provinces-fill",
      type: "fill",
      ...vectorLayer("nepal", sl),
      minzoom: appear,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#3b82f6",
          "#2563eb",
        ],
        "fill-opacity": layerFillOpacity(appear, peak, 0.08, 0.25),
      },
    },
    {
      id: "nepal-provinces-glow",
      type: "line",
      ...vectorLayer("nepal", sl),
      minzoom: appear,
      paint: {
        "line-color": "#93c5fd",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 1.5, 12, 3],
        "line-opacity": layerLineOpacity(appear, peak, 0.3),
      },
    },
    {
      id: "nepal-provinces-line",
      type: "line",
      ...vectorLayer("nepal", sl),
      minzoom: appear,
      paint: {
        "line-color": "#2563eb",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.2, 12, 2.5],
        "line-opacity": layerLineOpacity(appear, peak, 0.9),
      },
    },
  ];
}

function indiaStateLayers(format) {
  const sl = sourceLayerFor("india", format);
  const z = DETAIL_ZOOM;

  return [
    {
      id: "india-states-fill",
      type: "fill",
      ...vectorLayer("india", sl),
      minzoom: z,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#34d399",
          "#059669",
        ],
        "fill-opacity": detailFillOpacity(z, 0.08, 0.25),
      },
    },
    {
      id: "india-states-glow",
      type: "line",
      ...vectorLayer("india", sl),
      minzoom: z,
      paint: {
        "line-color": "#6ee7b7",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 1.5, 12, 3],
        "line-opacity": detailLineOpacity(z, 0.3),
      },
    },
    {
      id: "india-states-line",
      type: "line",
      ...vectorLayer("india", sl),
      minzoom: z,
      paint: {
        "line-color": "#047857",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.2, 12, 2.5],
        "line-opacity": detailLineOpacity(z, 0.9),
      },
    },
  ];
}

export function detailLayers(format) {
  return [...nepalProvinceLayers(format), ...indiaStateLayers(format)];
}

export function nepalDistrictSources(format) {
  if (format === "geojson") {
    return {
      "nepal-districts": {
        type: "geojson",
        data: "/geojsons/nepal-districts.geojson",
        promoteId: "id",
      },
    };
  }
  return {
    "nepal-districts": {
      type: "vector",
      url: "pmtiles:///nepal-districts.pmtiles",
      promoteId: "id",
    },
  };
}

export function nepalDistrictLayers(format) {
  const sl = sourceLayerFor("nepal-districts", format);
  const appear = NEPAL_DISTRICT_ZOOM;
  const peak = NEPAL_DISTRICT_FULL_ZOOM;

  return [
    {
      id: "nepal-districts-fill",
      type: "fill",
      ...vectorLayer("nepal-districts", sl),
      minzoom: appear,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#fbbf24",
          "#d97706",
        ],
        "fill-opacity": layerFillOpacity(appear, peak, 0.12, 0.3),
      },
    },
    {
      id: "nepal-districts-glow",
      type: "line",
      ...vectorLayer("nepal-districts", sl),
      minzoom: appear,
      paint: {
        "line-color": "#fde68a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 8, 1.2, 14, 2.5],
        "line-opacity": layerLineOpacity(appear, peak, 0.35),
      },
    },
    {
      id: "nepal-districts-line",
      type: "line",
      ...vectorLayer("nepal-districts", sl),
      minzoom: appear,
      paint: {
        "line-color": "#b45309",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 8, 1, 14, 2],
        "line-opacity": layerLineOpacity(appear, peak, 0.9),
      },
    },
  ];
}

export function nepalLocalSources(format) {
  if (format === "geojson") {
    return {
      "nepal-local": {
        type: "geojson",
        data: "/geojsons/nepal-local.geojson",
        promoteId: "locallevel_fullcode",
      },
    };
  }
  return {
    "nepal-local": {
      type: "vector",
      url: "pmtiles:///nepal-local.pmtiles",
      promoteId: "locallevel_fullcode",
    },
  };
}

export function nepalLocalLayers(format) {
  const sl = sourceLayerFor("nepal-local", format);
  const appear = NEPAL_LOCAL_ZOOM;
  const peak = NEPAL_LOCAL_FULL_ZOOM;

  return [
    {
      id: "nepal-local-fill",
      type: "fill",
      ...vectorLayer("nepal-local", sl),
      minzoom: appear,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#e879f9",
          "#c026d3",
        ],
        "fill-opacity": layerFillOpacity(appear, peak, 0.1, 0.28),
      },
    },
    {
      id: "nepal-local-glow",
      type: "line",
      ...vectorLayer("nepal-local", sl),
      minzoom: appear,
      paint: {
        "line-color": "#f0abfc",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.4, 12, 1.2, 16, 2.5],
        "line-opacity": layerLineOpacity(appear, peak, 0.35),
      },
    },
    {
      id: "nepal-local-line",
      type: "line",
      ...vectorLayer("nepal-local", sl),
      minzoom: appear,
      paint: {
        "line-color": "#a21caf",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 1, 16, 2],
        "line-opacity": layerLineOpacity(appear, peak, 0.9),
      },
    },
  ];
}

export function buildMapStyle(format) {
  return {
    version: 8,
    sources: { world: worldSource(format) },
    layers: worldLayers(format),
  };
}

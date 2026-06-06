/** Detail overlays appear at this zoom and above */
export const DETAIL_ZOOM = 4;

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
    tagline: "Download all · parse all",
    hint: "Every source file must fully download and be parsed as JSON before the map can render. Size is similar to PMTiles — the slowness is the all-at-once download and browser parsing, not the file size alone.",
    points: [
      "3 separate HTTP requests, each returns the entire file",
      "Browser parses the full JSON into memory",
      "Zoom stutters — thousands of raw polygons re-render every frame",
    ],
  },
  pmtiles: {
    label: "PMTiles",
    tagline: "Byte-range · on demand",
    hint: "MapLibre requests only the byte ranges it needs from each archive. Tiles are pre-built — no full-file download, no JSON parsing, data streams as you pan and zoom.",
    points: [
      "HTTP Range requests fetch small chunks",
      "Pre-tiled & simplified per zoom level",
      "Smooth zoom — only visible tiles are rendered",
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
    sourceLayer: "districts",
    fillLayer: "nepal-districts-fill",
    labelKey: "DISTRICT",
    fallbackLabel: "Province",
  },
  IND: {
    source: "india",
    sourceLayer: "districts",
    fillLayer: "india-districts-fill",
    labelKey: "NAME_1",
    fallbackLabel: "State",
  },
};

export function detailSourceLayer(format) {
  return format === "pmtiles" ? "districts" : null;
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

function detailFillOpacity(normal, hover) {
  const hoverState = ["boolean", ["feature-state", "hover"], false];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    DETAIL_ZOOM - 0.5,
    0,
    DETAIL_ZOOM,
    ["case", hoverState, hover, normal],
    DETAIL_ZOOM + 2,
    ["case", hoverState, hover * 1.5, normal * 1.5],
  ];
}

function detailLineOpacity(base) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    DETAIL_ZOOM - 0.5,
    0,
    DETAIL_ZOOM,
    base,
    DETAIL_ZOOM + 2,
    base * 1.5,
  ];
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

export function detailLayers(format) {
  const detailSl = format === "pmtiles" ? "districts" : null;

  return [
    {
      id: "nepal-districts-fill",
      type: "fill",
      ...vectorLayer("nepal", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#3b82f6",
          "#2563eb",
        ],
        "fill-opacity": detailFillOpacity(0.08, 0.25),
      },
    },
    {
      id: "nepal-district-glow",
      type: "line",
      ...vectorLayer("nepal", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "line-color": "#93c5fd",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.5,
          8,
          1.5,
          12,
          3,
        ],
        "line-opacity": detailLineOpacity(0.3),
      },
    },
    {
      id: "nepal-districts",
      type: "line",
      ...vectorLayer("nepal", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "line-color": "#2563eb",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.6,
          8,
          1.2,
          12,
          2.5,
        ],
        "line-opacity": detailLineOpacity(0.9),
      },
    },
    {
      id: "india-districts-fill",
      type: "fill",
      ...vectorLayer("india", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#34d399",
          "#059669",
        ],
        "fill-opacity": detailFillOpacity(0.08, 0.25),
      },
    },
    {
      id: "india-district-glow",
      type: "line",
      ...vectorLayer("india", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "line-color": "#6ee7b7",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.5,
          8,
          1.5,
          12,
          3,
        ],
        "line-opacity": detailLineOpacity(0.3),
      },
    },
    {
      id: "india-districts",
      type: "line",
      ...vectorLayer("india", detailSl),
      minzoom: DETAIL_ZOOM,
      paint: {
        "line-color": "#047857",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.6,
          8,
          1.2,
          12,
          2.5,
        ],
        "line-opacity": detailLineOpacity(0.9),
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

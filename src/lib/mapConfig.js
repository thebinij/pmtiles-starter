export const DETAIL_ZOOM = 4;
export const NEPAL_DISTRICT_ZOOM = 5;
export const NEPAL_DISTRICT_FULL_ZOOM = 6;
export const NEPAL_LOCAL_ZOOM = 7;
export const NEPAL_LOCAL_FULL_ZOOM = 8;
export const USA_STATE_ZOOM = 1.8;
export const USA_COUNTY_ZOOM = 4.5;
export const USA_COUNTY_FULL_ZOOM = 5;

export const USA_DETAIL_BOUNDS = [
  [171.09509, 25.120779],
  [-66.979601, 71.351633],
];

export const USA_DETAIL_CENTER = [-110.2471, 45.3781];

export const WORLD_BOUNDS = [
  [-175, -55],
  [175, 78],
];

export const WORLD_FIT_PADDING = 20;
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
  USA: {
    source: "usa-states",
    fillLayer: "usa-states-fill",
    labelKey: "name",
    fallbackLabel: "State",
    minZoom: USA_STATE_ZOOM,
  },
};

export const USA_COUNTY_MAP = {
  source: "usa-counties",
  fillLayer: "usa-counties-fill",
  labelKey: "NAME",
  fallbackLabel: "County",
  minZoom: USA_COUNTY_ZOOM,
  parent: { prop: "STATEFP", lookup: "us-state-fips", fips: true },
};

export const NEPAL_DISTRICT_MAP = {
  source: "nepal-districts",
  fillLayer: "nepal-districts-fill",
  labelKey: "DISTRICT",
  fallbackLabel: "District",
  minZoom: NEPAL_DISTRICT_ZOOM,
  parent: { prop: "PROVINCE", lookup: "nepal-provinces" },
};

export const NEPAL_LOCAL_MAP = {
  source: "nepal-local",
  fillLayer: "nepal-local-fill",
  labelKey: "locallevel_name",
  fallbackLabel: "Local unit",
  minZoom: NEPAL_LOCAL_ZOOM,
  parent: "district",
};

export const PARENT_LOOKUPS = {
  "us-state-fips": {
    "01": "Alabama",
    "02": "Alaska",
    "04": "Arizona",
    "05": "Arkansas",
    "06": "California",
    "08": "Colorado",
    "09": "Connecticut",
    "10": "Delaware",
    "11": "District of Columbia",
    "12": "Florida",
    "13": "Georgia",
    "15": "Hawaii",
    "16": "Idaho",
    "17": "Illinois",
    "18": "Indiana",
    "19": "Iowa",
    "20": "Kansas",
    "21": "Kentucky",
    "22": "Louisiana",
    "23": "Maine",
    "24": "Maryland",
    "25": "Massachusetts",
    "26": "Michigan",
    "27": "Minnesota",
    "28": "Mississippi",
    "29": "Missouri",
    "30": "Montana",
    "31": "Nebraska",
    "32": "Nevada",
    "33": "New Hampshire",
    "34": "New Jersey",
    "35": "New Mexico",
    "36": "New York",
    "37": "North Carolina",
    "38": "North Dakota",
    "39": "Ohio",
    "40": "Oklahoma",
    "41": "Oregon",
    "42": "Pennsylvania",
    "44": "Rhode Island",
    "45": "South Carolina",
    "46": "South Dakota",
    "47": "Tennessee",
    "48": "Texas",
    "49": "Utah",
    "50": "Vermont",
    "51": "Virginia",
    "53": "Washington",
    "54": "West Virginia",
    "55": "Wisconsin",
    "56": "Wyoming",
    "72": "Puerto Rico",
  },
};

export const DYNAMIC_PARENT_LOOKUPS = {
  "nepal-provinces": {
    source: "nepal",
    key: "Province",
    label: "DISTRICT",
  },
};

const dynamicLookupCache = new Map();

export function sourceLayerFor(sourceId, format) {
  if (format !== "pmtiles") return null;
  const layers = {
    nepal: "provinces",
    "nepal-districts": "districts",
    "nepal-local": "locallevels",
    india: "districts",
    "usa-states": "states",
    "usa-counties": "counties",
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

export function countryCode(props) {
  return props.adm0_a3 || props.ADM0_A3;
}

export function isUsaCountry(props) {
  const code = countryCode(props);
  const formal = props.formal_en || props.FORMAL_EN;
  return code === "USA" || formal === "United States of America";
}

export function hasDetailMap(props) {
  const code = countryCode(props);
  const formal = props.formal_en || props.FORMAL_EN;
  return (
    code === "NPL" ||
    code === "IND" ||
    code === "USA" ||
    formal === "Nepal" ||
    formal === "India" ||
    formal === "United States of America"
  );
}

export function featureBounds(feature) {
  const coords = [];

  function walk(ring) {
    if (typeof ring[0] === "number") {
      coords.push(ring);
      return;
    }
    for (const part of ring) walk(part);
  }

  walk(feature.geometry.coordinates);

  const lats = coords.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const rawLons = coords.map((c) => c[0]);
  let minLon = Math.min(...rawLons);
  let maxLon = Math.max(...rawLons);

  if (maxLon - minLon > 180) {
    const normLons = rawLons.map((lon) => (lon < 0 ? lon + 360 : lon));
    minLon = Math.min(...normLons);
    maxLon = Math.max(...normLons);
  }

  const west = minLon > 180 ? minLon - 360 : minLon;
  const east = maxLon > 180 ? maxLon - 360 : maxLon;

  return [
    [west, minLat],
    [east, maxLat],
  ];
}

export function countryClickBounds(feature, props) {
  return isUsaCountry(props) ? USA_DETAIL_BOUNDS : featureBounds(feature);
}

export function countryFitOptions(props) {
  return {
    padding: 60,
    maxZoom: countryCode(props) === "NPL" ? 7.5 : 6.5,
  };
}

export function usaCountryCamera(map) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const aspect = w / h;
  const lng = USA_DETAIL_CENTER[0] + (aspect - 2.2) * 3;
  const lat = USA_DETAIL_CENTER[1] - Math.max(0, aspect - 2.5) * 2;

  return {
    center: [lng, lat],
    zoom: USA_STATE_ZOOM,
  };
}

export function countryClickZoom(props) {
  if (!hasDetailMap(props)) return null;
  return isUsaCountry(props) ? USA_STATE_ZOOM : DETAIL_ZOOM;
}

export function featureLabel(feature, detail) {
  if (detail.labelKey && feature.properties[detail.labelKey]) {
    return feature.properties[detail.labelKey];
  }
  return detail.fallbackLabel;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function popupHtml(title, subtitle) {
  const safeTitle = escapeHtml(title);
  if (!subtitle) return `<strong>${safeTitle}</strong>`;
  return `<strong>${safeTitle}</strong><br><span class="popup-sub">${escapeHtml(subtitle)}</span>`;
}

function buildDynamicLookup(map, format, lookupId) {
  const spec = DYNAMIC_PARENT_LOOKUPS[lookupId];
  if (!spec || !map.getSource(spec.source)) return {};

  const sourceLayer = sourceLayerFor(spec.source, format);
  const query = sourceLayer ? { sourceLayer } : {};
  const table = {};

  for (const feature of map.querySourceFeatures(spec.source, query)) {
    const props = feature.properties;
    const key = props[spec.key];
    const label = props[spec.label];
    if (key != null && label) table[key] = label;
  }

  return table;
}

function getDynamicLookup(map, format, lookupId) {
  const cacheKey = `${format}:${lookupId}`;
  if (!dynamicLookupCache.has(cacheKey)) {
    dynamicLookupCache.set(cacheKey, buildDynamicLookup(map, format, lookupId));
  }
  return dynamicLookupCache.get(cacheKey);
}

export function clearDynamicParentLookups() {
  dynamicLookupCache.clear();
}

export function resolveParentLabel(map, format, props, parent) {
  if (!parent) return null;

  if (typeof parent === "string") {
    const value = props[parent];
    return value == null || value === "" ? null : String(value);
  }

  let raw = props[parent.prop];
  if (raw == null && parent.fips && props.GEOID) {
    raw = String(props.GEOID).slice(0, 2);
  }
  if (raw == null || raw === "") return null;

  const key = parent.fips ? String(raw).padStart(2, "0") : raw;

  if (parent.lookup && PARENT_LOOKUPS[parent.lookup]) {
    return PARENT_LOOKUPS[parent.lookup][key] ?? null;
  }

  if (parent.lookup && DYNAMIC_PARENT_LOOKUPS[parent.lookup]) {
    const table = getDynamicLookup(map, format, parent.lookup);
    return table[key] ?? null;
  }

  return String(raw);
}

export function regionPopupHtml(map, format, feature, detail) {
  const subtitle = resolveParentLabel(
    map,
    format,
    feature.properties,
    detail.parent,
  );
  return popupHtml(featureLabel(feature, detail), subtitle);
}

export function countryPopupHtml(props) {
  return popupHtml(countryName(props));
}

export function featureStateTarget(source, sourceLayer, id) {
  const target = { source, id };
  if (sourceLayer) target.sourceLayer = sourceLayer;
  return target;
}

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
      "usa-states": {
        type: "geojson",
        data: "/geojsons/usa-states.geojson",
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
    "usa-states": {
      type: "vector",
      url: "pmtiles:///usa-states.pmtiles",
      promoteId: "name",
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

function usaStateLayers(format) {
  const sl = sourceLayerFor("usa-states", format);
  const z = USA_STATE_ZOOM;
  const hoverState = ["boolean", ["feature-state", "hover"], false];

  return [
    {
      id: "usa-states-fill",
      type: "fill",
      ...vectorLayer("usa-states", sl),
      minzoom: z,
      paint: {
        "fill-color": [
          "case",
          hoverState,
          "#f87171",
          "#dc2626",
        ],
        "fill-opacity": ["case", hoverState, 0.3, 0.12],
      },
    },
    {
      id: "usa-states-glow",
      type: "line",
      ...vectorLayer("usa-states", sl),
      minzoom: z,
      paint: {
        "line-color": "#fca5a5",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1.8, 0.6, 4, 1, 8, 1.5, 12, 3],
        "line-opacity": 0.55,
      },
    },
    {
      id: "usa-states-line",
      type: "line",
      ...vectorLayer("usa-states", sl),
      minzoom: z,
      paint: {
        "line-color": "#b91c1c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1.8, 0.8, 4, 1.2, 8, 1.8, 12, 2.5],
        "line-opacity": 0.95,
      },
    },
  ];
}

export function detailLayers(format) {
  return [
    ...nepalProvinceLayers(format),
    ...indiaStateLayers(format),
    ...usaStateLayers(format),
  ];
}

export function usaCountySources(format) {
  if (format === "geojson") {
    return {
      "usa-counties": {
        type: "geojson",
        data: "/geojsons/usa-counties.geojson",
        promoteId: "GEOID",
      },
    };
  }
  return {
    "usa-counties": {
      type: "vector",
      url: "pmtiles:///usa-counties.pmtiles",
      promoteId: "GEOID",
    },
  };
}

export function usaCountyLayers(format) {
  const sl = sourceLayerFor("usa-counties", format);
  const appear = USA_COUNTY_ZOOM;
  const peak = USA_COUNTY_FULL_ZOOM;

  return [
    {
      id: "usa-counties-fill",
      type: "fill",
      ...vectorLayer("usa-counties", sl),
      minzoom: appear,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#fbbf24",
          "#d97706",
        ],
        "fill-opacity": layerFillOpacity(appear, peak, 0.1, 0.28),
      },
    },
    {
      id: "usa-counties-glow",
      type: "line",
      ...vectorLayer("usa-counties", sl),
      minzoom: appear,
      paint: {
        "line-color": "#fde68a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 0.4, 8, 1.2, 14, 2.5],
        "line-opacity": layerLineOpacity(appear, peak, 0.35),
      },
    },
    {
      id: "usa-counties-line",
      type: "line",
      ...vectorLayer("usa-counties", sl),
      minzoom: appear,
      paint: {
        "line-color": "#b45309",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 0.5, 8, 1, 14, 2],
        "line-opacity": layerLineOpacity(appear, peak, 0.9),
      },
    },
  ];
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

import { layerRenderOptions } from "./mapPerformance.js";

export const MAP_OCEAN_COLOR = "#c8e4f2";
export const MAP_LAND_COLOR = "#f5f0e8";
/** Slightly deeper warm tan — hover stays in the land family, not blue. */
export const MAP_LAND_HOVER_COLOR = "#ebe3d6";

/** Boundary colors per detail tier: base line + lighter hover shade (earth tones). */
export const DETAIL_BORDER = {
  usaState: { line: "#a84838", hover: "#d46250" },
  indiaState: { line: "#6d5d48", hover: "#8f7a62" },
  nepalProvince: { line: "#4a6b4f", hover: "#628569" },
  county: { line: "#c49a2c", hover: "#deb650" },
  district: { line: "#9a7344", hover: "#b68f5c" },
  local: { line: "#7a5c6d", hover: "#9a758b" },
};

export const DETAIL_ZOOM = 4;
export const COUNTRY_LABEL_MAX_ZOOM = DETAIL_ZOOM;
export const INDIA_STATE_ZOOM = 3;
export const NEPAL_PROVINCE_ZOOM = 5.5;
export const NEPAL_PROVINCE_FULL_ZOOM = 6;
export const NEPAL_DISTRICT_ZOOM = 6.5;
export const NEPAL_DISTRICT_FULL_ZOOM = 7;
export const NEPAL_LOCAL_ZOOM = 7.5;
export const NEPAL_LOCAL_FULL_ZOOM = 8;
export const USA_STATE_ZOOM = 2.5;
export const USA_COUNTY_ZOOM = 5.5;
export const USA_COUNTY_FULL_ZOOM = 6;

/** Continental US, Alaska, Hawaii, Puerto Rico, and U.S. Virgin Islands. */
export const USA_DETAIL_BOUNDS = [
  [171.09509, 17.0],
  [-64.5, 71.351633],
];

/** Guam and Northern Mariana Islands. */
export const USA_PACIFIC_BOUNDS = [
  [144.0, 13.0],
  [146.5, 20.5],
];

/** American Samoa. */
export const USA_SAMOA_BOUNDS = [
  [-171.5, -14.5],
  [-168.0, -14.0],
];

export const USA_DETAIL_VIEW_BOUNDS = [
  USA_DETAIL_BOUNDS,
  USA_PACIFIC_BOUNDS,
  USA_SAMOA_BOUNDS,
];

/** Separate world-map countries that are U.S. territories (load USA detail over them). */
export const US_TERRITORY_CODES = new Set([
  "PRI",
  "VIR",
  "GUM",
  "MNP",
  "ASM",
]);

export const DETAIL_REGIONS = {
  NPL: {
    bounds: [
      [80.060148, 26.347837],
      [88.201434, 30.473111],
    ],
    minZoom: NEPAL_PROVINCE_ZOOM,
  },
  IND: {
    bounds: [
      [68.165039, 6.748682],
      [97.343555, 35.495898],
    ],
    minZoom: INDIA_STATE_ZOOM,
  },
  USA: {
    bounds: USA_DETAIL_BOUNDS,
    minZoom: USA_STATE_ZOOM,
  },
};

export const WORLD_BOUNDS = [
  [-175, -55],
  [175, 78],
];

export const WORLD_FIT_PADDING = 20;
export const WORLD_DEFAULT_ZOOM = 0.5;
export const WORLD_MIN_ZOOM = 0.5;
/** Below this zoom only one world is drawn; at/above it horizontal wrap copies appear. */
export const WORLD_COPIES_MIN_ZOOM = 1.5;
export const WORLD_MAX_ZOOM = DETAIL_ZOOM - 0.1;

export const OVERLAY_LIMITS = {
  unloadOnExit: true,
  hideOnExit: true,
  evictHiddenAfterMs: 5 * 60 * 1000,
};

export const FORMAT_META = {
  geojson: { label: "GeoJSON" },
  pmtiles: { label: "PMTiles" },
};

export function worldMeta(format) {
  if (format === "geojson") {
    return { sourceLayer: null, promoteId: "ADM0_A3" };
  }
  return { sourceLayer: "boundaries", promoteId: "ADM0_A3" };
}

const DETAIL_PMTILES_SOURCE = {
  "usa-states": "usa",
  "usa-counties": "usa",
  "nepal-districts": "nepal",
  "nepal-local": "nepal",
};

export function detailMapSource(detail, format) {
  const pmtilesId = DETAIL_PMTILES_SOURCE[detail.source] ?? detail.source;
  return overlaySourceId(format, pmtilesId, detail.source);
}

export function detailMapSourceLayer(detail, format) {
  return sourceLayerFor(detail.fillLayer, format);
}

export const DETAIL_MAPS = {
  NPL: {
    source: "nepal",
    fillLayer: "nepal-provinces-fill",
    labelKey: "DISTRICT",
    fallbackLabel: "Province",
    minZoom: NEPAL_PROVINCE_ZOOM,
  },
  IND: {
    source: "india",
    fillLayer: "india-states-fill",
    labelKey: "NAME_1",
    fallbackLabel: "State",
    minZoom: INDIA_STATE_ZOOM,
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

export const OVERLAY_TIERS = [
  {
    id: "usa-states",
    regions: ["USA"],
    loadZoom: USA_STATE_ZOOM,
    fillLayer: "usa-states-fill",
    sources: (format) => regionSources(format, "USA"),
    layers: (format) => regionLayers(format, "USA"),
    detail: DETAIL_MAPS.USA,
  },
  {
    id: "npl-provinces",
    regions: ["NPL"],
    loadZoom: NEPAL_PROVINCE_ZOOM,
    fillLayer: "nepal-provinces-fill",
    sources: (format) => regionSources(format, "NPL"),
    layers: (format) => regionLayers(format, "NPL"),
    detail: DETAIL_MAPS.NPL,
  },
  {
    id: "ind-states",
    regions: ["IND"],
    loadZoom: INDIA_STATE_ZOOM,
    fillLayer: "india-states-fill",
    sources: (format) => regionSources(format, "IND"),
    layers: (format) => regionLayers(format, "IND"),
    detail: DETAIL_MAPS.IND,
  },
  {
    id: "npl-districts",
    regions: ["NPL"],
    loadZoom: NEPAL_DISTRICT_ZOOM,
    requires: ["npl-provinces"],
    fillLayer: "nepal-districts-fill",
    sources: nepalDistrictSources,
    layers: nepalDistrictLayers,
    detail: NEPAL_DISTRICT_MAP,
  },
  {
    id: "usa-counties",
    regions: ["USA"],
    loadZoom: USA_COUNTY_ZOOM,
    requires: ["usa-states"],
    fillLayer: "usa-counties-fill",
    sources: usaCountySources,
    layers: usaCountyLayers,
    detail: USA_COUNTY_MAP,
  },
  {
    id: "npl-local",
    regions: ["NPL"],
    loadZoom: NEPAL_LOCAL_ZOOM,
    requires: ["npl-districts"],
    fillLayer: "nepal-local-fill",
    sources: nepalLocalSources,
    layers: nepalLocalLayers,
    detail: NEPAL_LOCAL_MAP,
  },
];

export const OVERLAY_TIER_BY_ID = Object.fromEntries(
  OVERLAY_TIERS.map((tier) => [tier.id, tier]),
);

export const OVERLAY_SOURCE_IDS = new Set(
  OVERLAY_TIERS.flatMap((tier) => [
    ...Object.keys(tier.sources("pmtiles")),
    ...Object.keys(tier.sources("geojson")),
  ]),
);

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

const PMTILES_LAYER_BY_FILL = {
  "nepal-provinces-fill": "provinces",
  "nepal-districts-fill": "districts",
  "nepal-local-fill": "locallevels",
  "india-states-fill": "states",
  "usa-states-fill": "states",
  "usa-counties-fill": "counties",
};

function pmtilesVectorSource(url, promoteId, maxzoom) {
  return { type: "vector", url, promoteId, maxzoom };
}

function overlaySourceId(format, pmtilesId, geojsonId) {
  return format === "pmtiles" ? pmtilesId : geojsonId;
}

function sharedPmtilesSource(format, pmtilesId) {
  if (format !== "pmtiles") return {};
  return { [pmtilesId]: detailSources(format)[pmtilesId] };
}

export function sourceLayerFor(sourceOrFillLayer, format) {
  if (format !== "pmtiles") return null;
  if (PMTILES_LAYER_BY_FILL[sourceOrFillLayer]) {
    return PMTILES_LAYER_BY_FILL[sourceOrFillLayer];
  }
  const bySource = { nepal: "provinces", india: "states", usa: "states" };
  return bySource[sourceOrFillLayer] ?? null;
}

export function countryName(props) {
  return (
    props.formal_en ||
    props.FORMAL_EN ||
    props.name_en ||
    props.NAME_EN ||
    props.NAME ||
    props.name ||
    props.admin ||
    props.ADMIN ||
    props.abbrev ||
    props.ABBREV ||
    "Unknown"
  );
}

export const MAP_GLYPHS =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

export const WORLD_LABEL_SOURCE = "world-labels";

export function countryLabelText() {
  return ["coalesce", ["get", "NAME"], ["get", "name"], ""];
}

export function countryLabelOpacity() {
  return 1;
}

function countryLabelSizeAt(large, medium, small) {
  return [
    "case",
    ["<=", ["coalesce", ["get", "LABELRANK"], 6], 2],
    large,
    ["<=", ["coalesce", ["get", "LABELRANK"], 6], 4],
    medium,
    small,
  ];
}

export function countryLabelSize() {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    1,
    countryLabelSizeAt(13, 10, 8),
    1.5,
    countryLabelSizeAt(14, 11, 9),
    2.2,
    countryLabelSizeAt(14, 12, 10),
    4,
    countryLabelSizeAt(15, 12, 10),
    6,
    countryLabelSizeAt(17, 14, 11),
  ];
}

export function countryCode(props) {
  return props.adm0_a3 || props.ADM0_A3;
}

export function centerInBounds(lng, lat, bounds) {
  const [[west, south], [east, north]] = bounds;
  const inLat = lat >= south && lat <= north;
  if (west > east) return inLat && (lng >= west || lng <= east);
  return inLat && lng >= west && lng <= east;
}

function longitudeRanges(west, east) {
  if (west <= east) return [[west, east]];
  return [
    [west, 180],
    [-180, east],
  ];
}

function rangesOverlap(aRanges, bRanges) {
  for (const [a0, a1] of aRanges) {
    for (const [b0, b1] of bRanges) {
      if (a0 <= b1 && b0 <= a1) return true;
    }
  }
  return false;
}

export function boundsIntersect(boundsA, boundsB) {
  const [[aWest, aSouth], [aEast, aNorth]] = boundsA;
  const [[bWest, bSouth], [bEast, bNorth]] = boundsB;
  if (aSouth > bNorth || bSouth > aNorth) return false;
  return rangesOverlap(
    longitudeRanges(aWest, aEast),
    longitudeRanges(bWest, bEast),
  );
}

export function viewBoundsFromMap(map) {
  const bounds = map.getBounds();
  return [
    [bounds.getWest(), bounds.getSouth()],
    [bounds.getEast(), bounds.getNorth()],
  ];
}

function regionCenter(bounds) {
  const [[west, south], [east, north]] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}

function usaDetailInView(lng, lat, viewBounds = null) {
  return USA_DETAIL_VIEW_BOUNDS.some((bounds) =>
    viewBounds
      ? boundsIntersect(viewBounds, bounds)
      : centerInBounds(lng, lat, bounds),
  );
}

function usaDetailCenter() {
  return regionCenter(USA_DETAIL_BOUNDS);
}

export function regionsRankedInView(lng, lat, zoom, viewBounds = null) {
  const ranked = [];
  for (const [code, region] of Object.entries(DETAIL_REGIONS)) {
    if (zoom < region.minZoom) continue;
    const inView =
      code === "USA"
        ? usaDetailInView(lng, lat, viewBounds)
        : viewBounds
          ? boundsIntersect(viewBounds, region.bounds)
          : centerInBounds(lng, lat, region.bounds);
    if (!inView) continue;
    const [rLng, rLat] =
      code === "USA" ? usaDetailCenter() : regionCenter(region.bounds);
    const dist2 = (lng - rLng) ** 2 + (lat - rLat) ** 2;
    ranked.push({ code, score: -dist2 });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

export function regionsInView(lng, lat, zoom, viewBounds = null) {
  return regionsRankedInView(lng, lat, zoom, viewBounds).map(
    (entry) => entry.code,
  );
}

export function regionSources(format, code) {
  const sources = detailSources(format);
  if (code === "NPL") return { nepal: sources.nepal };
  if (code === "IND") return { india: sources.india };
  if (code === "USA") {
    return format === "pmtiles"
      ? { usa: sources.usa }
      : { "usa-states": sources["usa-states"] };
  }
  return {};
}

export function regionLayers(format, code) {
  if (code === "NPL") return nepalProvinceLayers(format);
  if (code === "IND") return indiaStateLayers(format);
  if (code === "USA") return usaStateLayers(format);
  return [];
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
  return popupHtml(countryName(props), null);
}

export function featureStateTarget(source, sourceLayer, id) {
  const target = { source, id };
  if (sourceLayer) target.sourceLayer = sourceLayer;
  return target;
}

const PROMOTE_ID_BY_FILL_LAYER = {
  "nepal-provinces-fill": "TARGET",
  "india-states-fill": "ID_1",
  "usa-states-fill": "name",
  "usa-counties-fill": "GEOID",
  "nepal-districts-fill": "DISTRICT",
  "nepal-local-fill": "locallevel_fullcode",
};

/**
 * Id for setFeatureState — must match the source promoteId value MapLibre uses
 * internally. Prefer feature.id when it agrees with the promote property; fall
 * back to the property when tiles still expose tippecanoe --generate-ids.
 */
export function resolveFeatureStateId(feature, fillLayer) {
  if (!feature) return undefined;
  const key = PROMOTE_ID_BY_FILL_LAYER[fillLayer];
  const fromProp = key ? feature.properties?.[key] : undefined;
  const hasProp =
    fromProp !== undefined && fromProp !== null && fromProp !== "";
  const rawId = feature.id;
  const hasId = rawId !== undefined && rawId !== null && rawId !== "";

  if (hasId && hasProp && String(rawId) === String(fromProp)) return rawId;
  if (hasProp) return fromProp;
  if (hasId) return rawId;
  return undefined;
}

export function buildRegionFeatureTarget(tier, feature, format) {
  const id = resolveFeatureStateId(feature, tier.detail.fillLayer);
  if (id === undefined) return null;

  const source = detailMapSource(tier.detail, format);
  const target = { source, id };
  const sourceLayer = detailMapSourceLayer(tier.detail, format);
  if (sourceLayer) target.sourceLayer = sourceLayer;
  return target;
}

function tierDetailFillVisible(map, tier, format, zoom) {
  if (zoom < tier.loadZoom) return false;
  for (const spec of tier.layers(format)) {
    if (spec.type !== "fill") continue;
    if (!map.getLayer(spec.id)) continue;
    if (map.getLayoutProperty(spec.id, "visibility") === "none") continue;
    const layer = map.getLayer(spec.id);
    const minZoom = layer.minzoom ?? spec.minzoom ?? 0;
    const maxZoom = layer.maxzoom ?? spec.maxzoom ?? 24;
    if (zoom >= minZoom && zoom < maxZoom) return true;
  }
  return false;
}

/** Country codes with a visible detail overlay at the current zoom. */
export function countriesWithActiveDetail(map, format, zoom = map.getZoom()) {
  const active = new Set();
  for (const tier of OVERLAY_TIERS) {
    if (!tier.detail || !tierDetailFillVisible(map, tier, format, zoom)) continue;
    for (const code of tier.regions) active.add(code);
  }
  if (active.has("USA")) {
    for (const code of US_TERRITORY_CODES) active.add(code);
  }
  return active;
}

export function countryHasActiveDetail(map, format, code, zoom = map.getZoom()) {
  if (code == null || code === "") return false;
  return countriesWithActiveDetail(map, format, zoom).has(String(code));
}

export function featureCountryCode(feature) {
  if (!feature) return null;
  if (feature.id != null && feature.id !== "") return String(feature.id);
  return countryCode(feature.properties ?? {}) ?? null;
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

/** Transparent fill for hit-testing; hover fill matches country land highlight. */
function detailInteractiveFillPaint() {
  return {
    "fill-color": ["case", HOVER_STATE, MAP_LAND_HOVER_COLOR, MAP_LAND_COLOR],
    "fill-opacity": ["case", HOVER_STATE, 0.92, 0],
  };
}

const BORDER_COLOR = "#000000";
const HOVER_STATE = ["boolean", ["feature-state", "hover"], false];
/** Relative border weight per admin level (scaled by zoom below). */
const BORDER_WEIGHT = {
  country: { base: 0.5, glow: 1.35, hover: 1.5 },
  countryHover: { base: 0.55, glow: 1.55, hover: 1.4 },
  region: { base: 0.48, glow: 1.4, hover: 1.45 },
  district: { base: 0.34, glow: 1.35, hover: 1.35 },
  local: { base: 0.26, glow: 1.3, hover: 1.3 },
};

function onHover(hoverValue, defaultValue) {
  return ["case", HOVER_STATE, hoverValue, defaultValue];
}


const ZOOM_BORDER_STOPS = [0.75, 1, 1.3, 1.7, 2.4, 3.3, 5.5];
const ZOOM_BORDER_OFFSETS = [0, 1, 2, 3, 5, 7];
const ZOOM_BORDER_MAX = 16;

/** Zoom must be top-level in interpolate — scale factors are baked into stop outputs. */
function zoomBorderWidth(minZoom, multiplier) {
  const stops = [];
  for (let i = 0; i < ZOOM_BORDER_OFFSETS.length; i++) {
    stops.push(minZoom + ZOOM_BORDER_OFFSETS[i], ZOOM_BORDER_STOPS[i] * multiplier);
  }
  stops.push(ZOOM_BORDER_MAX, ZOOM_BORDER_STOPS[ZOOM_BORDER_STOPS.length - 1] * multiplier);
  return [
    "interpolate",
    ["exponential", 1.65],
    ["zoom"],
    ...stops,
  ];
}

function borderLinePaint(weight, options = {}) {
  const {
    minZoom = WORLD_MIN_ZOOM,
    glow = false,
    opacity = 0.85,
    hoverOpacity = 1,
    hoverOnly = false,
  } = options;
  const multiplier = weight.base * (glow ? weight.glow : 1);
  const paint = {
    "line-color": BORDER_COLOR,
    "line-width": zoomBorderWidth(minZoom, multiplier),
  };
  if (hoverOnly) {
    paint["line-opacity"] = onHover(hoverOpacity, 0);
  } else {
    paint["line-opacity"] = opacity;
  }
  return paint;
}

function detailBoundaryLinePaint(weight, minZoom, peak, border, opacity = 0.9) {
  const { line, hover } = border;
  return {
    "line-color": ["case", HOVER_STATE, hover, line],
    "line-width": zoomBorderWidth(minZoom, weight.base),
    "line-opacity": layerLineOpacity(minZoom, peak, opacity),
  };
}

function detailBoundaryGlowPaint(weight, minZoom, peak, color, opacity = 0.22) {
  return {
    "line-color": color,
    "line-width": zoomBorderWidth(minZoom, weight.base * weight.glow),
    "line-opacity": layerLineOpacity(minZoom, peak, opacity),
  };
}

function detailBoundaryHoverPaint(weight, minZoom, color) {
  return {
    "line-color": color,
    "line-width": zoomBorderWidth(minZoom, weight.base * weight.hover),
    "line-opacity": onHover(1, 0),
  };
}

function appendDetailBoundaryLayers(layers, {
  source,
  sl,
  appear,
  peak,
  weight,
  border,
  idPrefix,
  lineOpacity = 0.9,
  glowOpacity = 0.22,
}) {
  const { line, hover } = border;
  const { glow } = layerRenderOptions();
  if (glow) {
    layers.push({
      id: `${idPrefix}-glow`,
      type: "line",
      ...vectorLayer(source, sl),
      minzoom: appear,
      paint: detailBoundaryGlowPaint(weight, appear, peak, line, glowOpacity),
    });
  }
  layers.push({
    id: `${idPrefix}-line`,
    type: "line",
    ...vectorLayer(source, sl),
    minzoom: appear,
    paint: detailBoundaryLinePaint(weight, appear, peak, border, lineOpacity),
  });
  layers.push({
    id: `${idPrefix}-boundary-hover`,
    type: "line",
    ...vectorLayer(source, sl),
    minzoom: appear,
    paint: detailBoundaryHoverPaint(weight, appear, hover),
  });
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
    promoteId: { boundaries: "ADM0_A3" },
  };
}

function worldLabelsSource() {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "ADM0_A3",
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
        promoteId: "name",
      },
    };
  }
  return {
    nepal: pmtilesVectorSource("pmtiles:///nepal.pmtiles", {
      provinces: "TARGET",
      districts: "DISTRICT",
      locallevels: "locallevel_fullcode",
    }, 12),
    india: pmtilesVectorSource("pmtiles:///india.pmtiles", "ID_1", 7),
    usa: pmtilesVectorSource("pmtiles:///usa.pmtiles", {
      states: "name",
      counties: "GEOID",
    }, 10),
  };
}

function worldLayers(format) {
  const worldSl = format === "pmtiles" ? "boundaries" : null;
  const hoverState = ["boolean", ["feature-state", "hover"], false];

  return [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": MAP_OCEAN_COLOR,
      },
    },
    {
      id: "world-countries-fill",
      type: "fill",
      ...vectorLayer("world", worldSl),
      paint: {
        "fill-color": [
          "case",
          hoverState,
          MAP_LAND_HOVER_COLOR,
          MAP_LAND_COLOR,
        ],
        "fill-opacity": [
          "case",
          hoverState,
          0.92,
          0.96,
        ],
      },
    },
    {
      id: "world-boundary-glow",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: {
        ...borderLinePaint(BORDER_WEIGHT.country, { glow: true, opacity: 0.25 }),
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DETAIL_ZOOM,
          0.25,
          DETAIL_ZOOM + 1,
          0.1,
        ],
      },
    },
    {
      id: "world-boundary",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: {
        ...borderLinePaint(BORDER_WEIGHT.country),
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
    {
      id: "world-countries-boundary-highlight-glow",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: borderLinePaint(BORDER_WEIGHT.countryHover, {
        glow: true,
        hoverOnly: true,
        hoverOpacity: 0.35,
      }),
    },
    {
      id: "world-countries-boundary-highlight",
      type: "line",
      ...vectorLayer("world", worldSl),
      paint: borderLinePaint(BORDER_WEIGHT.countryHover, { hoverOnly: true }),
    },
    {
      id: "world-countries-label",
      type: "symbol",
      source: WORLD_LABEL_SOURCE,
      filter: ["!=", countryLabelText(), ""],
      layout: {
        "text-field": countryLabelText(),
        "text-font": ["Open Sans Semibold"],
        "text-size": countryLabelSize(),
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "text-padding": 2,
        "text-max-width": 10,
      },
      paint: {
        "text-color": "#334155",
        "text-halo-color": "#f8fafc",
        "text-halo-width": 1.5,
        "text-opacity": countryLabelOpacity(),
      },
    },
  ];
}

function nepalProvinceLayers(format) {
  const source = overlaySourceId(format, "nepal", "nepal");
  const sl = sourceLayerFor("nepal-provinces-fill", format);
  const appear = NEPAL_PROVINCE_ZOOM;
  const peak = NEPAL_PROVINCE_FULL_ZOOM;

  const layers = [
    {
      id: "nepal-provinces-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: appear,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear,
    peak,
    weight: BORDER_WEIGHT.region,
    border: DETAIL_BORDER.nepalProvince,
    idPrefix: "nepal-provinces",
    lineOpacity: 0.9,
    glowOpacity: 0.2,
  });
  return layers;
}

function indiaStateLayers(format) {
  const source = overlaySourceId(format, "india", "india");
  const sl = sourceLayerFor("india-states-fill", format);
  const z = INDIA_STATE_ZOOM;
  const peak = z + 0.5;

  const layers = [
    {
      id: "india-states-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: z,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear: z,
    peak,
    weight: BORDER_WEIGHT.region,
    border: DETAIL_BORDER.indiaState,
    idPrefix: "india-states",
    lineOpacity: 0.9,
    glowOpacity: 0.2,
  });
  return layers;
}

function usaStateLayers(format) {
  const source = overlaySourceId(format, "usa", "usa-states");
  const sl = sourceLayerFor("usa-states-fill", format);
  const z = USA_STATE_ZOOM;
  const peak = z + 0.5;
  const layers = [
    {
      id: "usa-states-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: z,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear: z,
    peak,
    weight: BORDER_WEIGHT.region,
    border: DETAIL_BORDER.usaState,
    idPrefix: "usa-states",
    lineOpacity: 0.9,
    glowOpacity: 0.2,
  });
  return layers;
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
  return sharedPmtilesSource(format, "usa");
}

export function usaCountyLayers(format) {
  const source = overlaySourceId(format, "usa", "usa-counties");
  const sl = sourceLayerFor("usa-counties-fill", format);
  const appear = USA_COUNTY_ZOOM;
  const peak = USA_COUNTY_FULL_ZOOM;

  const layers = [
    {
      id: "usa-counties-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: appear,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear,
    peak,
    weight: BORDER_WEIGHT.district,
    border: DETAIL_BORDER.county,
    idPrefix: "usa-counties",
    lineOpacity: 0.85,
    glowOpacity: 0.18,
  });
  return layers;
}

export function nepalDistrictSources(format) {
  if (format === "geojson") {
    return {
      "nepal-districts": {
        type: "geojson",
        data: "/geojsons/nepal-districts.geojson",
        promoteId: "DISTRICT",
      },
    };
  }
  return sharedPmtilesSource(format, "nepal");
}

export function nepalDistrictLayers(format) {
  const source = overlaySourceId(format, "nepal", "nepal-districts");
  const sl = sourceLayerFor("nepal-districts-fill", format);
  const appear = NEPAL_DISTRICT_ZOOM;
  const peak = NEPAL_DISTRICT_FULL_ZOOM;

  const layers = [
    {
      id: "nepal-districts-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: appear,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear,
    peak,
    weight: BORDER_WEIGHT.district,
    border: DETAIL_BORDER.district,
    idPrefix: "nepal-districts",
    lineOpacity: 0.85,
    glowOpacity: 0.18,
  });
  return layers;
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
  return sharedPmtilesSource(format, "nepal");
}

export function nepalLocalLayers(format) {
  const source = overlaySourceId(format, "nepal", "nepal-local");
  const sl = sourceLayerFor("nepal-local-fill", format);
  const appear = NEPAL_LOCAL_ZOOM;
  const peak = NEPAL_LOCAL_FULL_ZOOM;

  const layers = [
    {
      id: "nepal-local-fill",
      type: "fill",
      ...vectorLayer(source, sl),
      minzoom: appear,
      paint: detailInteractiveFillPaint(),
    },
  ];
  appendDetailBoundaryLayers(layers, {
    source,
    sl,
    appear,
    peak,
    weight: BORDER_WEIGHT.local,
    border: DETAIL_BORDER.local,
    idPrefix: "nepal-local",
    lineOpacity: 0.8,
    glowOpacity: 0.15,
  });
  return layers;
}

export function buildMapStyle(format) {
  return {
    version: 8,
    glyphs: MAP_GLYPHS,
    sources: {
      world: worldSource(format),
      [WORLD_LABEL_SOURCE]: worldLabelsSource(),
    },
    layers: worldLayers(format),
  };
}

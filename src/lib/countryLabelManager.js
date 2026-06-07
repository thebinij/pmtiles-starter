import {
  COUNTRY_LABEL_MAX_ZOOM,
  OVERLAY_TIERS,
  WORLD_LABEL_SOURCE,
} from "./mapConfig.js";

const OVERLAP_PAD = 8;
const LABELS_URL = "/geojsons/world-labels.geojson";
const TEXT_MAX_WIDTH_EMS = 10;

function textSizePx(rank, zoom) {
  const large = rank <= 2;
  const medium = rank <= 4;
  if (zoom < 1.5) return large ? 13 : medium ? 10 : 8;
  if (zoom < 2.2) return large ? 14 : medium ? 11 : 9;
  if (zoom < 4) return large ? 15 : medium ? 12 : 10;
  return large ? 17 : medium ? 14 : 11;
}

function labelTextBox(name, rank, zoom) {
  const size = textSizePx(rank, zoom);
  const maxLineWidth = TEXT_MAX_WIDTH_EMS * size;
  const contentWidth = name.length * size * 0.72;
  const singleLineWidth = contentWidth + 14;
  const width = Math.min(singleLineWidth, maxLineWidth);
  const lines = Math.max(1, Math.ceil(singleLineWidth / maxLineWidth));
  return {
    width,
    height: lines * size * 1.35 + 8,
  };
}

function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function displayLngLat(map, lng, lat) {
  const centerLng = map.getCenter().lng;
  let displayLng = lng;
  while (displayLng - centerLng > 180) displayLng -= 360;
  while (displayLng - centerLng < -180) displayLng += 360;
  return [displayLng, lat];
}

function pointInView(map, lng, lat) {
  const bounds = map.getBounds();
  if (lat < bounds.getSouth() || lat > bounds.getNorth()) return false;
  const [displayLng] = displayLngLat(map, lng, lat);
  const west = bounds.getWest();
  const east = bounds.getEast();
  if (west <= east) return displayLng >= west && displayLng <= east;
  return displayLng >= west || displayLng <= east;
}

function screenBoxAroundPoint(map, lng, lat, width, height, pad = 0) {
  const { x, y } = map.project(displayLngLat(map, lng, lat));
  return {
    x: x - width / 2 - pad,
    y: y - height / 2 - pad,
    width: width + pad * 2,
    height: height + pad * 2,
  };
}

function landmassScreenBox(map, props) {
  const nw = map.project(
    displayLngLat(map, props.BBOX_MIN_LNG, props.BBOX_MAX_LAT),
  );
  const ne = map.project(
    displayLngLat(map, props.BBOX_MAX_LNG, props.BBOX_MAX_LAT),
  );
  const sw = map.project(
    displayLngLat(map, props.BBOX_MIN_LNG, props.BBOX_MIN_LAT),
  );
  const se = map.project(
    displayLngLat(map, props.BBOX_MAX_LNG, props.BBOX_MIN_LAT),
  );

  const xs = [nw.x, ne.x, sw.x, se.x];
  const ys = [nw.y, ne.y, sw.y, se.y];

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function anchorInsideLandmass(map, lng, lat, landmassBox) {
  const { x, y } = map.project(displayLngLat(map, lng, lat));
  return (
    x >= landmassBox.x &&
    x <= landmassBox.x + landmassBox.width &&
    y >= landmassBox.y &&
    y <= landmassBox.y + landmassBox.height
  );
}

function landmassLargeEnough(landmassBox, rank, zoom) {
  const base = rank <= 2 ? 36 : rank <= 4 ? 24 : 16;
  const scale = Math.max(0.45, Math.min(1, zoom / 2.2));
  const minWidth = base * scale;
  const minHeight = minWidth * 0.45;
  return landmassBox.width >= minWidth && landmassBox.height >= minHeight;
}

function tierVisible(map, tier) {
  if (!map.getLayer(tier.fillLayer)) return false;
  return map.getLayoutProperty(tier.fillLayer, "visibility") !== "none";
}

function countryDetailVisible(map, code) {
  return OVERLAY_TIERS.some(
    (tier) =>
      tier.regions.includes(code) &&
      tier.detail &&
      tierVisible(map, tier),
  );
}

function hideForDetailView(map, code, zoom) {
  return zoom >= COUNTRY_LABEL_MAX_ZOOM && countryDetailVisible(map, code);
}

export function pickVisibleCountryLabels(map, allLabels) {
  const zoom = map.getZoom();
  const candidates = [];

  for (const feature of allLabels) {
    const props = feature.properties ?? {};
    const code = props.ADM0_A3;
    const name = props.NAME || "";
    if (!code || !name) continue;

    const [lng, lat] = feature.geometry.coordinates;
    if (!pointInView(map, lng, lat)) continue;
    if (hideForDetailView(map, code, zoom)) continue;

    const landmassBox = landmassScreenBox(map, props);
    if (!landmassLargeEnough(landmassBox, props.LABELRANK ?? 6, zoom)) continue;
    if (!anchorInsideLandmass(map, lng, lat, landmassBox)) continue;

    const textBox = labelTextBox(name, props.LABELRANK ?? 6, zoom);
    const labelBox = screenBoxAroundPoint(map, lng, lat, textBox.width, textBox.height);

    candidates.push({
      feature,
      code,
      rank: props.LABELRANK ?? 6,
      labelBox: screenBoxAroundPoint(
        map,
        lng,
        lat,
        textBox.width,
        textBox.height,
        OVERLAP_PAD,
      ),
    });
  }

  candidates.sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code));

  const placed = [];
  const winners = [];

  for (const candidate of candidates) {
    if (placed.some((box) => boxesOverlap(candidate.labelBox, box))) continue;
    placed.push(candidate.labelBox);
    winners.push(candidate.feature);
  }

  return winners;
}

function signature(features) {
  return features
    .map((feature) => feature.properties.ADM0_A3)
    .sort()
    .join("\u0000");
}

export function createCountryLabelManager({ map }) {
  let allLabels = null;
  let loadPromise = null;
  let lastSignature = "";

  function loadAllLabels() {
    if (allLabels) return Promise.resolve(allLabels);
    if (!loadPromise) {
      loadPromise = fetch(LABELS_URL)
        .then((res) => res.json())
        .then((data) => {
          allLabels = data.features ?? [];
          return allLabels;
        });
    }
    return loadPromise;
  }

  function applyLabels(features) {
    const source = map.getSource(WORLD_LABEL_SOURCE);
    if (!source) return;

    const next = signature(features);
    if (next === lastSignature) return;

    lastSignature = next;
    source.setData({
      type: "FeatureCollection",
      features,
    });
  }

  async function refresh() {
    if (!map.getLayer("world-countries-label")) return;

    const labels = await loadAllLabels();
    if (!labels.length) return;

    applyLabels(pickVisibleCountryLabels(map, labels));
  }

  function refreshNow() {
    if (!allLabels) {
      loadAllLabels().then(() => refresh());
      return;
    }
    if (!map.getLayer("world-countries-label")) return;
    applyLabels(pickVisibleCountryLabels(map, allLabels));
  }

  return {
    load: loadAllLabels,
    refresh,
    refreshNow,
  };
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import polylabel from "polylabel";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worldPath = path.join(root, "geojsons/world.geojson");
const outPath = path.join(root, "geojsons/world-labels.geojson");

function mercatorY(lat) {
  return (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
}

function unMercatorY(y) {
  return (Math.atan(Math.sinh((y * Math.PI) / 180)) * 180) / Math.PI;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    area += (x2 - x1) * (y2 + y1);
  }
  return Math.abs(area / 2);
}

function mercatorArea(polygon) {
  const ring = polygon[0].map(([lng, lat]) => [lng, mercatorY(lat)]);
  return ringArea(ring);
}

function unwrapRing(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, ring[i][1]]);
  }
  return out;
}

function polygonMercatorCentroid(ring) {
  const pts = ring.map(([lng, lat]) => [lng, mercatorY(lat)]);
  let cx = 0;
  let cy = 0;
  let area = 0;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[j];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area *= 0.5;
  if (Math.abs(area) < 1e-12) return null;

  cx /= 6 * area;
  cy /= 6 * area;
  return [cx, unMercatorY(cy)];
}

function mainLandmass(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let best = polygons[0];
  let bestArea = mercatorArea(polygons[0]);
  for (const polygon of polygons.slice(1)) {
    const area = mercatorArea(polygon);
    if (area > bestArea) {
      best = polygon;
      bestArea = area;
    }
  }
  return best;
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  const [outer, ...holes] = polygon;
  if (!pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function landmassBbox(polygon) {
  const ring = unwrapRing(polygon[0]);
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, minLat, maxLng, maxLat };
}

function labelCenter(main) {
  const centroid = polygonMercatorCentroid(unwrapRing(main[0]));
  if (centroid && pointInPolygon(centroid, main)) return centroid;
  return polylabel(main, 0.5).slice(0, 2);
}

function labelName(props) {
  const primary = props.NAME || props.ADMIN || "";
  let best = primary;
  for (const alt of [props.NAME_LONG, props.BRK_NAME]) {
    if (alt && alt.length < best.length && alt.length >= 4) best = alt;
  }
  return best;
}

const world = JSON.parse(fs.readFileSync(worldPath, "utf8"));
const features = world.features
  .filter((feature) => feature.properties?.ADM0_A3)
  .map((feature) => {
    const props = feature.properties;
    const main = mainLandmass(feature.geometry);
    const bbox = landmassBbox(main);
    return {
      type: "Feature",
      id: props.ADM0_A3,
      properties: {
        ADM0_A3: props.ADM0_A3,
        NAME: labelName(props),
        LABELRANK: props.LABELRANK ?? 6,
        BBOX_MIN_LNG: bbox.minLng,
        BBOX_MIN_LAT: bbox.minLat,
        BBOX_MAX_LNG: bbox.maxLng,
        BBOX_MAX_LAT: bbox.maxLat,
      },
      geometry: {
        type: "Point",
        coordinates: labelCenter(main),
      },
    };
  })
  .sort((a, b) => a.properties.ADM0_A3.localeCompare(b.properties.ADM0_A3));

fs.writeFileSync(
  outPath,
  `${JSON.stringify({ type: "FeatureCollection", features })}\n`,
);

console.log(`wrote ${features.length} label points to geojsons/world-labels.geojson`);

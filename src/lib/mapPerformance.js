export const MOBILE_TAP_HINT = "Tap again to open";

export function isMobileMap() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0
  );
}

export function mapPixelRatio() {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, 2);
}

export function layerRenderOptions() {
  return { glow: !isMobileMap() };
}

export function mapLibreOptions() {
  const mobile = isMobileMap();
  return {
    pixelRatio: mapPixelRatio(),
    fadeDuration: 0,
    maxTileCacheSize: mobile ? 80 : 120,
    cooperativeGestures: mobile,
  };
}

export function featureTapKey(layerId, feature) {
  const id = feature.id ?? feature.properties?.id ?? feature.properties?.ADM0_A3;
  return `${layerId}:${id}`;
}

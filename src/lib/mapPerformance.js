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

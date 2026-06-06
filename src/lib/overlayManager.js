import {
  NEPAL_DISTRICT_FULL_ZOOM,
  NEPAL_LOCAL_FULL_ZOOM,
  OVERLAY_LIMITS,
  OVERLAY_SOURCE_IDS,
  OVERLAY_TIER_BY_ID,
  OVERLAY_TIERS,
  USA_COUNTY_FULL_ZOOM,
  clearDynamicParentLookups,
  featureBounds,
  regionsInView,
  regionsRankedInView,
  regionPopupHtml,
  sourceLayerFor,
  viewBoundsFromMap,
} from "./mapConfig.js";

/**
 * @typedef {import('maplibre-gl').Map} MapLibreMap
 * @typedef {import('./mapConfig.js').OverlayTier} OverlayTier
 */

/**
 * @param {OverlayTier} tier
 * @param {string} format
 */
function tierLayerIds(tier, format) {
  return tier.layers(format).map((layer) => layer.id);
}

/**
 * @param {object} options
 * @param {MapLibreMap} options.map
 * @param {'geojson' | 'pmtiles'} options.format
 * @param {import('maplibre-gl').Popup} options.popup
 * @param {(source: object) => void} [options.trackSource]
 * @param {(bounds: number[][], minZoom: number, maxZoom?: number) => void} options.zoomToBounds
 * @param {() => void} options.onHoverClear
 * @param {(target: object) => void} options.setRegionHover
 * @param {() => void} options.clearRegionHover
 */
export function createOverlayManager({
  map,
  format,
  popup,
  trackSource = () => {},
  zoomToBounds,
  onHoverClear,
  setRegionHover,
  clearRegionHover,
}) {
  const tiersLoaded = new Set();
  const tiersPending = new Set();
  const tiersHandlersBound = new Set();
  /** @type {Map<string, { mousemove: (e: object) => void, mouseleave: () => void, click?: (e: object) => void }>} */
  const tierHandlerRefs = new Map();
  let tierChainScheduled = false;

  function atZoom(threshold) {
    return map.getZoom() >= threshold;
  }

  function viewContext() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const viewBounds = viewBoundsFromMap(map);
    const inView = regionsInView(center.lng, center.lat, zoom, viewBounds);
    const ranked = regionsRankedInView(center.lng, center.lat, zoom, viewBounds);
    return { center, zoom, viewBounds, inView, ranked };
  }

  function overlaySourcesReady(sourceIds) {
    return sourceIds.every((id) => {
      const source = map.getSource(id);
      return source && map.isSourceLoaded(id);
    });
  }

  function addLayers(sources, layers) {
    if (!map.isStyleLoaded()) return false;
    try {
      for (const [id, source] of Object.entries(sources)) {
        trackSource(source);
        if (!map.getSource(id)) map.addSource(id, source);
      }
      for (const layer of layers) {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
      }
      return true;
    } catch (error) {
      console.error("Failed to add map layers", error);
      return false;
    }
  }

  function tierRequirementsMet(tier) {
    return (tier.requires ?? []).every((id) => tiersLoaded.has(id));
  }

  function tierCountry(tier) {
    return tier.regions[0];
  }

  function tierIsActive(tier) {
    return (
      tiersLoaded.has(tier.id) ||
      tiersPending.has(tier.id) ||
      Boolean(map.getLayer(tier.fillLayer))
    );
  }

  function unbindTierHandlers(tier) {
    const refs = tierHandlerRefs.get(tier.id);
    if (!refs) return;
    map.off("mousemove", tier.fillLayer, refs.mousemove);
    map.off("mouseleave", tier.fillLayer, refs.mouseleave);
    if (refs.click) map.off("click", tier.fillLayer, refs.click);
    tierHandlerRefs.delete(tier.id);
    tiersHandlersBound.delete(tier.id);
  }

  function removeTierFromMap(tier) {
    for (const layerId of tierLayerIds(tier, format)) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    for (const sourceId of tier.sourceIds) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }

  function unloadTier(tier) {
    unbindTierHandlers(tier);
    removeTierFromMap(tier);
    tiersLoaded.delete(tier.id);
    tiersPending.delete(tier.id);
  }

  function unloadCountriesOutOfView(inView) {
    if (!OVERLAY_LIMITS.unloadOnExit) return;
    const keep = new Set(inView);
    for (const tier of OVERLAY_TIERS) {
      if (keep.has(tierCountry(tier))) continue;
      if (tierIsActive(tier)) unloadTier(tier);
    }
  }

  function bindTierHandlers(tier) {
    if (tiersHandlersBound.has(tier.id) || !tier.detail) return;
    tiersHandlersBound.add(tier.id);

    const { fillLayer, source, minZoom } = tier.detail;
    const options = buildHandlerOptions(tier);

    const onMouseMove = (e) => {
      if (map.getZoom() < minZoom || !e.features?.length) return;
      if (options.skipWhenDistrictZoom && atZoom(NEPAL_DISTRICT_FULL_ZOOM)) return;
      if (options.skipWhenLocalZoom && atZoom(NEPAL_LOCAL_FULL_ZOOM)) return;
      if (options.skipWhenCountyZoom && atZoom(USA_COUNTY_FULL_ZOOM)) return;
      onHoverClear();
      map.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      const target = {
        source,
        id: feature.id,
      };
      const sourceLayer = sourceLayerFor(source, format);
      if (sourceLayer) target.sourceLayer = sourceLayer;

      setRegionHover(target, feature);
      popup
        .setLngLat(e.lngLat)
        .setHTML(regionPopupHtml(map, format, feature, tier.detail))
        .addTo(map);
    };

    const onMouseLeave = () => {
      clearRegionHover();
      popup?.remove();
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", fillLayer, onMouseMove);
    map.on("mouseleave", fillLayer, onMouseLeave);

    const refs = { mousemove: onMouseMove, mouseleave: onMouseLeave };

    if (options.onClick) {
      const onClick = (e) => {
        if (map.getZoom() < minZoom || !e.features?.length) return;
        clearRegionHover();
        popup?.remove();
        options.onClick(e.features[0]);
      };
      map.on("click", fillLayer, onClick);
      refs.click = onClick;
    }

    tierHandlerRefs.set(tier.id, refs);
  }

  function buildHandlerOptions(tier) {
    const options = {};
    if (tier.id === "npl-provinces") {
      options.skipWhenDistrictZoom = true;
      options.skipWhenLocalZoom = true;
      options.onClick = (feature) => {
        ensureTier("npl-districts", { force: true });
        zoomToBounds(featureBounds(feature), NEPAL_DISTRICT_FULL_ZOOM, 8);
      };
    } else if (tier.id === "usa-states") {
      options.skipWhenCountyZoom = true;
      options.onClick = (feature) => {
        ensureTier("usa-counties", { force: true });
        zoomToBounds(featureBounds(feature), USA_COUNTY_FULL_ZOOM, 10);
      };
    } else if (tier.id === "ind-states") {
      options.onClick = (feature) => {
        const minZoom = Math.max(map.getZoom(), tier.detail.minZoom);
        zoomToBounds(featureBounds(feature), minZoom, 10);
      };
    } else if (tier.id === "npl-districts") {
      options.skipWhenLocalZoom = true;
      options.onClick = (feature) => {
        ensureTier("npl-local", { force: true });
        zoomToBounds(featureBounds(feature), NEPAL_LOCAL_FULL_ZOOM, 12);
      };
    } else if (tier.id === "usa-counties") {
      options.onClick = (feature) => {
        zoomToBounds(featureBounds(feature), USA_COUNTY_FULL_ZOOM + 1, 14);
      };
    }
    return options;
  }

  function completeTier(tier) {
    tiersPending.delete(tier.id);
    if (!tiersLoaded.has(tier.id)) {
      tiersLoaded.add(tier.id);
      clearDynamicParentLookups();
    }
  }

  function scheduleTierChain() {
    if (tierChainScheduled) return;
    tierChainScheduled = true;
    map.once("idle", () => {
      tierChainScheduled = false;
      ensureOverlaysLoaded();
    });
  }

  function loadTier(tier) {
    if (!map.isStyleLoaded()) return false;

    if (!map.getLayer(tier.fillLayer)) {
      if (!addLayers(tier.sources(format), tier.layers(format))) return false;
      if (!map.getLayer(tier.fillLayer)) return false;
    }

    bindTierHandlers(tier);

    if (overlaySourcesReady(tier.sourceIds)) {
      completeTier(tier);
      scheduleTierChain();
      return true;
    }

    tiersPending.add(tier.id);
    return true;
  }

  function promotePendingTiers() {
    let promoted = false;
    for (const tier of OVERLAY_TIERS) {
      if (!tiersPending.has(tier.id)) continue;
      if (!overlaySourcesReady(tier.sourceIds)) continue;
      completeTier(tier);
      promoted = true;
    }
    if (promoted) scheduleTierChain();
  }

  function tierPriority(tier, ranked) {
    const countryIndex = ranked.findIndex(
      (entry) => entry.code === tierCountry(tier),
    );
    const countryRank = countryIndex === -1 ? 999 : countryIndex;
    const tierIndex = OVERLAY_TIERS.indexOf(tier);
    return countryRank * 1000 + tierIndex;
  }

  function nextTierToLoad(inView, zoom, ranked) {
    const eligible = [];

    for (const tier of OVERLAY_TIERS) {
      if (zoom < tier.loadZoom) continue;
      if (!inView.includes(tierCountry(tier))) continue;
      if (tiersLoaded.has(tier.id) || tiersPending.has(tier.id)) continue;
      if (map.getLayer(tier.fillLayer)) continue;
      if (!tierRequirementsMet(tier)) return null;
      eligible.push(tier);
    }

    if (!eligible.length) return null;

    eligible.sort((a, b) => tierPriority(a, ranked) - tierPriority(b, ranked));
    return eligible[0];
  }

  function ensureTier(tierId, { force = false } = {}) {
    const tier = OVERLAY_TIER_BY_ID[tierId];
    if (!tier) return;

    const country = tierCountry(tier);
    const { inView } = viewContext();

    for (const requiredId of tier.requires ?? []) {
      const required = OVERLAY_TIER_BY_ID[requiredId];
      const requiredCountry = required ? tierCountry(required) : null;
      const prerequisiteForce = force || inView.includes(requiredCountry);
      ensureTier(requiredId, { force: prerequisiteForce });
    }

    if (!tierRequirementsMet(tier)) {
      scheduleTierChain();
      return;
    }

    if (tiersLoaded.has(tier.id) || tiersPending.has(tier.id)) return;

    if (map.getLayer(tier.fillLayer)) {
      if (overlaySourcesReady(tier.sourceIds)) completeTier(tier);
      else tiersPending.add(tier.id);
      return;
    }

    if (!force && !inView.includes(country)) return;
    if (!force && map.getZoom() < tier.loadZoom) return;
    loadTier(tier);
  }

  function ensureOverlaysLoaded() {
    promotePendingTiers();

    const { inView, zoom, ranked } = viewContext();
    unloadCountriesOutOfView(inView);

    const tier = nextTierToLoad(inView, zoom, ranked);
    if (tier) loadTier(tier);
  }

  function onSourceData(sourceId, isSourceLoaded) {
    if (!OVERLAY_SOURCE_IDS.has(sourceId) || !isSourceLoaded) return;
    promotePendingTiers();
    scheduleTierChain();
  }

  function inDetailView() {
    return viewContext().inView.length > 0;
  }

  function getFocusedRegions() {
    return viewContext().inView;
  }

  function destroy() {
    for (const tier of OVERLAY_TIERS) {
      if (tierIsActive(tier)) unloadTier(tier);
    }
  }

  return {
    ensureOverlaysLoaded,
    ensureTier,
    onSourceData,
    inDetailView,
    getFocusedRegions,
    destroy,
  };
}

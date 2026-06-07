import {
  NEPAL_DISTRICT_FULL_ZOOM,
  NEPAL_LOCAL_FULL_ZOOM,
  OVERLAY_LIMITS,
  OVERLAY_SOURCE_IDS,
  OVERLAY_TIERS,
  USA_COUNTY_FULL_ZOOM,
  buildRegionFeatureTarget,
  clearDynamicParentLookups,
  regionsInView,
  regionsRankedInView,
  regionPopupHtml,
  countriesWithActiveDetail,
  countryHasActiveDetail,
  viewBoundsFromMap,
} from "./mapConfig.js";
import { isMobileMap } from "./mapPerformance.js";

function tierLayerIds(tier, format) {
  return tier.layers(format).map((layer) => layer.id);
}

function tierSourceIds(tier, format) {
  return Object.keys(tier.sources(format));
}

export function createOverlayManager({
  map,
  format,
  popup,
  trackSource = () => {},
  onHoverClear,
  setRegionHover,
  clearRegionHover,
  onOverlaysChanged = () => {},
}) {
  const tiersLoaded = new Set();
  const tiersPending = new Set();
  const tiersHidden = new Set();
  const hiddenAt = new Map();
  const tiersHandlersBound = new Set();
  const tierHandlerRefs = new Map();
  const sourcesWithData = new Set();
  let tierChainScheduled = false;
  const touchMode = isMobileMap();

  function atZoom(threshold) {
    return map.getZoom() >= threshold;
  }

  function shouldSkipTierInteraction(options) {
    if (options.skipWhenDistrictZoom && atZoom(NEPAL_DISTRICT_FULL_ZOOM)) {
      return true;
    }
    if (options.skipWhenLocalZoom && atZoom(NEPAL_LOCAL_FULL_ZOOM)) return true;
    if (options.skipWhenCountyZoom && atZoom(USA_COUNTY_FULL_ZOOM)) return true;
    return false;
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
      if (!source) return false;
      if (map.isSourceLoaded(id)) return true;
      if (format === "pmtiles" && source.type === "vector") {
        return sourcesWithData.has(id);
      }
      return false;
    });
  }

  function releaseStuckPendingTiers() {
    if (format !== "pmtiles") return;
    for (const tier of OVERLAY_TIERS) {
      if (!tiersPending.has(tier.id)) continue;
      if (!map.getLayer(tier.fillLayer)) continue;
      const ids = tierSourceIds(tier, format);
      if (!ids.length || !ids.every((id) => map.getSource(id))) continue;
      completeTier(tier);
    }
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

  function tierLayerVisible(tier) {
    if (!map.getLayer(tier.fillLayer)) return false;
    return map.getLayoutProperty(tier.fillLayer, "visibility") !== "none";
  }

  function tierIsActive(tier) {
    return (
      tiersLoaded.has(tier.id) ||
      tiersPending.has(tier.id) ||
      tiersHidden.has(tier.id) ||
      Boolean(map.getLayer(tier.fillLayer))
    );
  }

  function setTierVisibility(tier, visible) {
    const vis = visible ? "visible" : "none";
    for (const layerId of tierLayerIds(tier, format)) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", vis);
      }
    }
  }

  function unbindTierHandlers(tier) {
    const refs = tierHandlerRefs.get(tier.id);
    if (!refs) return;
    if (refs.mousemove) map.off("mousemove", tier.fillLayer, refs.mousemove);
    if (refs.mouseleave) map.off("mouseleave", tier.fillLayer, refs.mouseleave);
    if (refs.click) map.off("click", tier.fillLayer, refs.click);
    tierHandlerRefs.delete(tier.id);
    tiersHandlersBound.delete(tier.id);
  }

  function showRegionPopup(tier, feature, lngLat) {
    onHoverClear();
    const target = buildRegionFeatureTarget(tier, feature, format);
    if (target) setRegionHover(target, feature);
    popup
      .setLngLat(lngLat)
      .setHTML(regionPopupHtml(map, format, feature, tier.detail))
      .addTo(map);
  }

  function isSourceUsedByOtherTiers(sourceId, excludeTier) {
    for (const tier of OVERLAY_TIERS) {
      if (tier.id === excludeTier.id) continue;
      if (!tierIsActive(tier)) continue;
      if (tierSourceIds(tier, format).includes(sourceId)) return true;
    }
    return false;
  }

  function removeTierFromMap(tier) {
    for (const layerId of tierLayerIds(tier, format)) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    for (const sourceId of tierSourceIds(tier, format)) {
      if (isSourceUsedByOtherTiers(sourceId, tier)) continue;
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }

  function hideTier(tier) {
    if (!map.getLayer(tier.fillLayer)) return;
    unbindTierHandlers(tier);
    setTierVisibility(tier, false);
    tiersPending.delete(tier.id);
    tiersHidden.add(tier.id);
    hiddenAt.set(tier.id, Date.now());
  }

  function showTier(tier) {
    if (!map.getLayer(tier.fillLayer)) return false;
    setTierVisibility(tier, true);
    tiersHidden.delete(tier.id);
    hiddenAt.delete(tier.id);
    if (!tiersLoaded.has(tier.id)) tiersLoaded.add(tier.id);
    bindTierHandlers(tier);
    map.triggerRepaint();
    scheduleTierChain();
    return true;
  }

  function restoreVisibleTiers(inView, zoom) {
    for (const tier of OVERLAY_TIERS) {
      if (!inView.includes(tierCountry(tier))) continue;
      if (zoom < tier.loadZoom) continue;
      if (!tiersHidden.has(tier.id)) continue;
      if (!map.getLayer(tier.fillLayer)) continue;
      if (!tierRequirementsMet(tier)) continue;
      showTier(tier);
    }
  }

  function unloadTier(tier) {
    unbindTierHandlers(tier);
    removeTierFromMap(tier);
    tiersLoaded.delete(tier.id);
    tiersPending.delete(tier.id);
    tiersHidden.delete(tier.id);
    hiddenAt.delete(tier.id);
  }

  function evictStaleHiddenTiers() {
    const maxAge = OVERLAY_LIMITS.evictHiddenAfterMs;
    if (!maxAge || !OVERLAY_LIMITS.hideOnExit) return;
    const now = Date.now();
    for (const tier of OVERLAY_TIERS) {
      if (!tiersHidden.has(tier.id)) continue;
      const hiddenSince = hiddenAt.get(tier.id) ?? now;
      if (now - hiddenSince < maxAge) continue;
      unloadTier(tier);
    }
  }

  function unloadCountriesOutOfView(inView) {
    if (!OVERLAY_LIMITS.unloadOnExit) return;
    const keep = new Set(inView);
    for (const tier of OVERLAY_TIERS) {
      if (keep.has(tierCountry(tier))) continue;
      if (!tierIsActive(tier)) continue;
      if (OVERLAY_LIMITS.hideOnExit) hideTier(tier);
      else unloadTier(tier);
    }
    evictStaleHiddenTiers();
  }

  function bindTierHandlers(tier) {
    if (tiersHandlersBound.has(tier.id) || !tier.detail) return;
    tiersHandlersBound.add(tier.id);

    const { fillLayer, minZoom } = tier.detail;
    const options = buildHandlerOptions(tier);
    const refs = {};

    if (!touchMode) {
      const onMouseMove = (e) => {
        if (map.getZoom() < minZoom || !e.features?.length) return;
        if (shouldSkipTierInteraction(options)) return;
        onHoverClear();
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features[0];
        const target = buildRegionFeatureTarget(tier, feature, format);
        if (target) setRegionHover(target, feature);
        else clearRegionHover();
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
      refs.mousemove = onMouseMove;
      refs.mouseleave = onMouseLeave;
    }

    if (touchMode) {
      const onClick = (e) => {
        if (map.getZoom() < minZoom || !e.features?.length) return;
        if (shouldSkipTierInteraction(options)) return;
        showRegionPopup(tier, e.features[0], e.lngLat);
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
    } else if (tier.id === "usa-states") {
      options.skipWhenCountyZoom = true;
    } else if (tier.id === "npl-districts") {
      options.skipWhenLocalZoom = true;
    }
    return options;
  }

  function completeTier(tier) {
    tiersPending.delete(tier.id);
    tiersHidden.delete(tier.id);
    hiddenAt.delete(tier.id);
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
      releaseStuckPendingTiers();
      promotePendingTiers();
      ensureOverlaysLoaded();
    });
  }

  function finishTierLoad(tier, sourceIds) {
    if (overlaySourcesReady(sourceIds)) {
      completeTier(tier);
      scheduleTierChain();
      return true;
    }
    tiersPending.add(tier.id);
    map.triggerRepaint();
    scheduleTierChain();
    return false;
  }

  function loadTier(tier) {
    if (!map.isStyleLoaded()) return false;

    const sourceIds = tierSourceIds(tier, format);

    if (map.getLayer(tier.fillLayer)) {
      if (tiersHidden.has(tier.id)) showTier(tier);
      bindTierHandlers(tier);
      finishTierLoad(tier, sourceIds);
      return true;
    }

    if (!addLayers(tier.sources(format), tier.layers(format))) return false;
    if (!map.getLayer(tier.fillLayer)) return false;

    bindTierHandlers(tier);
    return finishTierLoad(tier, sourceIds);
  }

  function promotePendingTiers() {
    releaseStuckPendingTiers();
    let promoted = false;
    for (const tier of OVERLAY_TIERS) {
      if (!tiersPending.has(tier.id)) continue;
      if (!overlaySourcesReady(tierSourceIds(tier, format))) continue;
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
      if (map.getLayer(tier.fillLayer) && tierLayerVisible(tier)) continue;
      if (!tierRequirementsMet(tier)) return null;
      eligible.push(tier);
    }

    if (!eligible.length) return null;

    eligible.sort((a, b) => tierPriority(a, ranked) - tierPriority(b, ranked));
    return eligible[0];
  }

  function ensureOverlaysLoaded() {
    promotePendingTiers();

    const { inView, zoom, ranked } = viewContext();
    unloadCountriesOutOfView(inView);
    restoreVisibleTiers(inView, zoom);

    const tier = nextTierToLoad(inView, zoom, ranked);
    if (tier) loadTier(tier);
    onOverlaysChanged();
  }

  function onSourceData(sourceId) {
    if (!OVERLAY_SOURCE_IDS.has(sourceId)) return;
    sourcesWithData.add(sourceId);
    promotePendingTiers();
    scheduleTierChain();
  }

  function inDetailView(countryCode) {
    if (countryCode != null && countryCode !== "") {
      return countryHasActiveDetail(map, format, countryCode);
    }
    return countriesWithActiveDetail(map, format).size > 0;
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
    onSourceData,
    inDetailView,
    getFocusedRegions,
    destroy,
  };
}

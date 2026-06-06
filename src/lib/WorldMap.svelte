<script>
  import { onMount, onDestroy } from "svelte";
  import maplibregl from "maplibre-gl";
  import { Protocol } from "pmtiles";
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    DETAIL_MAPS,
    DETAIL_ZOOM,
    NEPAL_DISTRICT_MAP,
    NEPAL_DISTRICT_ZOOM,
    NEPAL_DISTRICT_FULL_ZOOM,
    NEPAL_LOCAL_MAP,
    NEPAL_LOCAL_ZOOM,
    NEPAL_LOCAL_FULL_ZOOM,
    USA_COUNTY_MAP,
    USA_COUNTY_ZOOM,
    USA_COUNTY_FULL_ZOOM,
    USA_STATE_ZOOM,
    WORLD_BOUNDS,
    WORLD_FIT_PADDING,
    WORLD_MAX_ZOOM,
    buildMapStyle,
    countryClickBounds,
    countryClickZoom,
    countryFitOptions,
    isUsaCountry,
    usaCountryCamera,
    clearDynamicParentLookups,
    countryPopupHtml,
    detailLayers,
    detailSources,
    featureBounds,
    featureStateTarget,
    regionPopupHtml,
    nepalDistrictLayers,
    nepalDistrictSources,
    nepalLocalLayers,
    nepalLocalSources,
    usaCountyLayers,
    usaCountySources,
    sourceLayerFor,
    worldMeta,
  } from "./mapConfig.js";
  import { collectMapStats, createGeojsonLoadTracker } from "./mapStats.js";

  /** @type {'geojson' | 'pmtiles'} */
  let { format, onStats = () => {} } = $props();

  const geojsonTracker =
    format === "geojson" ? createGeojsonLoadTracker() : null;

  let mapContainer;
  let map;
  let popup;
  let hoveredCountryId = null;
  let hoveredRegion = null;
  let viewMode = "world";
  let detailLoaded = false;
  let nepalDistrictsLoaded = false;
  let nepalLocalLoaded = false;
  let usaCountiesLoaded = false;
  let detailHandlersBound = false;
  let nepalDistrictHandlersBound = false;
  let nepalLocalHandlersBound = false;
  let usaCountyHandlersBound = false;

  let pointerLng = $state(null);
  let pointerLat = $state(null);
  let centerLng = $state(0);
  let centerLat = $state(20);
  let mapZoom = $state(1);

  const worldSourceLayer = $derived(worldMeta(format).sourceLayer);
  const formatCoord = (lat, lng) =>
    `lat: ${lat.toFixed(5)}, lon: ${lng.toFixed(5)}`;
  const cursorCoords = $derived(
    pointerLat == null || pointerLng == null
      ? null
      : formatCoord(pointerLat, pointerLng),
  );
  const centerCoords = $derived(formatCoord(centerLat, centerLng));
  const zoomLabel = $derived(`zoom: ${mapZoom.toFixed(1)}`);

  function updateMapPosition() {
    if (!map) return;
    const center = map.getCenter();
    centerLng = center.lng;
    centerLat = center.lat;
    mapZoom = map.getZoom();
  }

  function trackGeojsonSource(source) {
    geojsonTracker?.markSource(source);
  }

  function reportStats() {
    onStats(collectMapStats(format, geojsonTracker));
  }

  function addSourceTracked(id, source) {
    trackGeojsonSource(source);
    if (!map.getSource(id)) map.addSource(id, source);
  }

  function clearCountryHover() {
    if (hoveredCountryId === null || !map) return;
    map.setFeatureState(
      featureStateTarget("world", worldSourceLayer, hoveredCountryId),
      { hover: false },
    );
    hoveredCountryId = null;
  }

  function clearRegionHover() {
    if (!hoveredRegion || !map) return;
    map.setFeatureState({ ...hoveredRegion }, { hover: false });
    hoveredRegion = null;
  }

  function dismissHoverUI() {
    clearCountryHover();
    clearRegionHover();
    popup?.remove();
    if (map) map.getCanvas().style.cursor = "";
  }

  function atZoom(threshold) {
    return map.getZoom() >= threshold;
  }

  function showDetailOverlays() {
    return (
      atZoom(DETAIL_ZOOM) ||
      (viewMode === "country" && atZoom(USA_STATE_ZOOM))
    );
  }

  function fitWorldView(duration = 0) {
    map.fitBounds(WORLD_BOUNDS, {
      padding: WORLD_FIT_PADDING,
      duration,
      maxZoom: WORLD_MAX_ZOOM,
    });
  }

  function zoomToBounds(bounds, minZoom, maxZoom = 8) {
    const camera = map.cameraForBounds(bounds, {
      padding: 40,
      maxZoom,
    });
    if (!camera) return;
    camera.zoom = Math.max(camera.zoom, minZoom);
    map.easeTo({ ...camera, duration: 500, essential: true });
  }

  function addLayers(sources, layers) {
    if (!map?.isStyleLoaded()) return;
    for (const [id, source] of Object.entries(sources)) {
      addSourceTracked(id, source);
    }
    for (const layer of layers) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
  }

  function bindRegionHandler(detail, options = {}) {
    const { fillLayer, source, minZoom } = detail;
    const {
      skipWhenDistrictZoom = false,
      skipWhenLocalZoom = false,
      skipWhenCountyZoom = false,
      onClick,
    } = options;

    map.on("mousemove", fillLayer, (e) => {
      if (map.getZoom() < minZoom || !e.features?.length) return;
      if (skipWhenDistrictZoom && atZoom(NEPAL_DISTRICT_FULL_ZOOM)) return;
      if (skipWhenLocalZoom && atZoom(NEPAL_LOCAL_FULL_ZOOM)) return;
      if (skipWhenCountyZoom && atZoom(USA_COUNTY_FULL_ZOOM)) return;
      clearCountryHover();
      map.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      const target = featureStateTarget(
        source,
        sourceLayerFor(source, format),
        feature.id,
      );
      if (
        hoveredRegion &&
        (hoveredRegion.id !== feature.id || hoveredRegion.source !== source)
      ) {
        clearRegionHover();
      }
      if (feature.id !== undefined) {
        hoveredRegion = target;
        map.setFeatureState(target, { hover: true });
      }

      popup
        .setLngLat(e.lngLat)
        .setHTML(regionPopupHtml(map, format, feature, detail))
        .addTo(map);
    });

    map.on("mouseleave", fillLayer, () => {
      dismissHoverUI();
    });

    if (onClick) {
      map.on("click", fillLayer, (e) => {
        if (map.getZoom() < minZoom || !e.features?.length) return;
        dismissHoverUI();
        onClick(e.features[0]);
      });
    }
  }

  function bindDetailHandlers() {
    if (detailHandlersBound) return;
    detailHandlersBound = true;

    for (const detail of Object.values(DETAIL_MAPS)) {
      const options = {};

      if (detail.source === "nepal") {
        options.skipWhenDistrictZoom = true;
        options.skipWhenLocalZoom = true;
        options.onClick = (feature) => {
          ensureNepalDistrictsLoaded();
          zoomToBounds(
            featureBounds(feature),
            NEPAL_DISTRICT_FULL_ZOOM,
            8,
          );
        };
      } else if (detail.source === "usa-states") {
        options.skipWhenCountyZoom = true;
        options.onClick = (feature) => {
          ensureUsaCountiesLoaded();
          zoomToBounds(
            featureBounds(feature),
            USA_COUNTY_FULL_ZOOM,
            10,
          );
        };
      }

      bindRegionHandler(detail, options);
    }
  }

  function bindNepalDistrictHandlers() {
    if (nepalDistrictHandlersBound) return;
    nepalDistrictHandlersBound = true;
    bindRegionHandler(NEPAL_DISTRICT_MAP, {
      skipWhenLocalZoom: true,
      onClick: (feature) => {
        ensureNepalLocalLoaded();
        zoomToBounds(featureBounds(feature), NEPAL_LOCAL_FULL_ZOOM, 12);
      },
    });
  }

  function bindNepalLocalHandlers() {
    if (nepalLocalHandlersBound) return;
    nepalLocalHandlersBound = true;
    bindRegionHandler(NEPAL_LOCAL_MAP);
  }

  function bindUsaCountyHandlers() {
    if (usaCountyHandlersBound) return;
    usaCountyHandlersBound = true;
    bindRegionHandler(USA_COUNTY_MAP, {
      onClick: (feature) => {
        zoomToBounds(featureBounds(feature), USA_COUNTY_FULL_ZOOM + 1, 14);
      },
    });
  }

  function ensureDetailLoaded() {
    if (detailLoaded || !map?.isStyleLoaded()) return;
    detailLoaded = true;
    addLayers(detailSources(format), detailLayers(format));
    clearDynamicParentLookups();
    bindDetailHandlers();
  }

  function ensureOverlaysLoaded() {
    if (showDetailOverlays()) ensureDetailLoaded();
    if (atZoom(NEPAL_DISTRICT_ZOOM)) ensureNepalDistrictsLoaded();
    if (atZoom(NEPAL_LOCAL_ZOOM)) ensureNepalLocalLoaded();
    if (atZoom(USA_COUNTY_ZOOM)) ensureUsaCountiesLoaded();
    reportStats();
  }

  function ensureNepalDistrictsLoaded() {
    if (nepalDistrictsLoaded) return;
    nepalDistrictsLoaded = true;
    addLayers(nepalDistrictSources(format), nepalDistrictLayers(format));
    bindNepalDistrictHandlers();
  }

  function ensureNepalLocalLoaded() {
    if (nepalLocalLoaded) return;
    nepalLocalLoaded = true;
    addLayers(nepalLocalSources(format), nepalLocalLayers(format));
    bindNepalLocalHandlers();
  }

  function ensureUsaCountiesLoaded() {
    if (usaCountiesLoaded) return;
    usaCountiesLoaded = true;
    addLayers(usaCountySources(format), usaCountyLayers(format));
    bindUsaCountyHandlers();
  }

  onMount(() => {
    if (format === "pmtiles") {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
    }

    map = new maplibregl.Map({
      container: mapContainer,
      style: buildMapStyle(format),
      center: [0, 20],
      zoom: 1,
      renderWorldCopies: false,
    });

    const zoomRate = 1 / 280;
    map.scrollZoom.setWheelZoomRate(zoomRate);
    map.scrollZoom.setZoomRate(zoomRate);
    map.touchZoomRotate.setZoomRate(1.5);

    map.once("load", () => {
      if (format === "geojson") {
        trackGeojsonSource({
          type: "geojson",
          data: "/geojsons/world.geojson",
        });
      }
      fitWorldView();
      updateMapPosition();
      reportStats();
    });

    map.on("mousemove", (e) => {
      pointerLng = e.lngLat.lng;
      pointerLat = e.lngLat.lat;
    });

    map.on("mouseleave", () => {
      pointerLng = null;
      pointerLat = null;
    });

    map.on("move", updateMapPosition);
    map.on("zoomend", () => {
      updateMapPosition();
      ensureOverlaysLoaded();
      reportStats();
    });

    const statsTimer = setInterval(reportStats, 2000);

    let resizeTimer;
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (viewMode === "world") fitWorldView();
      }, 150);
    });
    resizeObserver.observe(mapContainer);

    popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    map.on("mousemove", "world-countries-fill", (e) => {
      if (showDetailOverlays()) {
        dismissHoverUI();
        return;
      }
      if (!e.features?.length) return;
      map.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      if (hoveredCountryId !== null && hoveredCountryId !== feature.id) {
        clearCountryHover();
      }
      if (feature.id !== undefined && hoveredCountryId !== feature.id) {
        hoveredCountryId = feature.id;
        map.setFeatureState(
          featureStateTarget("world", worldSourceLayer, feature.id),
          { hover: true },
        );
      }

      popup
        .setLngLat(e.lngLat)
        .setHTML(countryPopupHtml(feature.properties))
        .addTo(map);
    });

    map.on("mouseleave", "world-countries-fill", () => {
      if (showDetailOverlays()) return;
      dismissHoverUI();
    });

    map.on("zoom", () => {
      ensureOverlaysLoaded();
      if (showDetailOverlays()) dismissHoverUI();
    });

    map.on("click", "world-countries-fill", (e) => {
      if (!e.features?.length) return;
      dismissHoverUI();
      const feature = e.features[0];
      const props = feature.properties;

      map.resize();

      let camera = isUsaCountry(props)
        ? usaCountryCamera(map)
        : map.cameraForBounds(
            countryClickBounds(feature, props),
            countryFitOptions(props),
          );
      if (!camera) return;

      viewMode = "country";

      const targetZoom = countryClickZoom(props);
      if (targetZoom != null) {
        ensureDetailLoaded();
        if (!isUsaCountry(props)) camera.zoom = targetZoom;
      }

      map.easeTo({ ...camera, duration: 500, essential: true });
      map.once("moveend", () => {
        dismissHoverUI();
        ensureOverlaysLoaded();
      });
    });

    return () => {
      clearTimeout(resizeTimer);
      clearInterval(statsTimer);
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    reportStats();
    popup?.remove();
    map?.remove();
  });
</script>

<div class="map-wrap">
  <div class="map" bind:this={mapContainer}></div>
  <footer class="map-footer" aria-live="polite">
    <span class="footer-coords">{zoomLabel}</span>
    <span class="footer-sep" aria-hidden="true"></span>
    {#if cursorCoords}
      <span class="footer-coords">{cursorCoords}</span>
      <span class="footer-sep" aria-hidden="true"></span>
    {/if}
    <span class="footer-coords">{centerCoords}</span>
  </footer>
</div>

<style>
  .map-wrap {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .map {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .map-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.65rem;
    background: #f8fafc;
    border-top: 1px solid #c5d5e4;
    font-size: 0.68rem;
  }

  .footer-coords {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #3d4f63;
  }

  .footer-sep {
    width: 1px;
    height: 0.75rem;
    background: #c5d5e4;
  }

  :global(.maplibregl-popup-content) {
    padding: 10px 14px;
    font-size: 14px;
  }

  :global(.maplibregl-popup-content .popup-sub) {
    font-size: 12px;
    color: #64748b;
  }
</style>

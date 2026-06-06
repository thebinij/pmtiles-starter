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
    WORLD_BOUNDS,
    WORLD_FIT_PADDING,
    WORLD_MAX_ZOOM,
    buildMapStyle,
    countryName,
    detailLayers,
    detailSources,
    featureLabel,
    featureStateTarget,
    hasDetailMap,
    nepalDistrictLayers,
    nepalDistrictSources,
    nepalLocalLayers,
    nepalLocalSources,
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
  let detailHandlersBound = false;
  let nepalDistrictHandlersBound = false;
  let nepalLocalHandlersBound = false;

  let pointerLng = $state(null);
  let pointerLat = $state(null);
  let centerLng = $state(0);
  let centerLat = $state(20);

  const worldSourceLayer = $derived(worldMeta(format).sourceLayer);
  const cursorCoords = $derived(
    pointerLat == null || pointerLng == null
      ? null
      : `${pointerLat.toFixed(5)}, ${pointerLng.toFixed(5)}`,
  );
  const centerCoords = $derived(
    `${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}`,
  );

  function updateMapPosition() {
    if (!map) return;
    const center = map.getCenter();
    centerLng = center.lng;
    centerLat = center.lat;
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

  function atDetailZoom() {
    return map.getZoom() >= DETAIL_ZOOM;
  }

  function atNepalDistrictZoom() {
    return map.getZoom() >= NEPAL_DISTRICT_ZOOM;
  }

  function atNepalDistrictFullZoom() {
    return map.getZoom() >= NEPAL_DISTRICT_FULL_ZOOM;
  }

  function atNepalLocalZoom() {
    return map.getZoom() >= NEPAL_LOCAL_ZOOM;
  }

  function atNepalLocalFullZoom() {
    return map.getZoom() >= NEPAL_LOCAL_FULL_ZOOM;
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

  function featureBounds(feature) {
    const coords = [];

    function walk(ring) {
      if (typeof ring[0] === "number") {
        coords.push(ring);
        return;
      }
      for (const part of ring) walk(part);
    }

    walk(feature.geometry.coordinates);
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
  }

  function bindRegionHandler(detail, options = {}) {
    const { fillLayer, source, minZoom } = detail;
    const {
      skipWhenDistrictZoom = false,
      skipWhenLocalZoom = false,
      onClick,
      clickHint = "Click to explore",
    } = options;

    map.on("mousemove", fillLayer, (e) => {
      if (map.getZoom() < minZoom || !e.features?.length) return;
      if (skipWhenDistrictZoom && atNepalDistrictFullZoom()) return;
      if (skipWhenLocalZoom && atNepalLocalFullZoom()) return;
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

      const name = featureLabel(feature, detail);
      const hint = onClick ? `<br><em>${clickHint}</em>` : "";
      popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>${hint}`).addTo(map);
    });

    map.on("mouseleave", fillLayer, () => {
      map.getCanvas().style.cursor = "";
      clearRegionHover();
      popup.remove();
    });

    if (onClick) {
      map.on("click", fillLayer, (e) => {
        if (map.getZoom() < minZoom || !e.features?.length) return;
        clearRegionHover();
        popup.remove();
        onClick(e.features[0]);
      });
    }
  }

  function bindDetailHandlers() {
    if (detailHandlersBound) return;
    detailHandlersBound = true;

    for (const detail of Object.values(DETAIL_MAPS)) {
      bindRegionHandler(detail, {
        skipWhenDistrictZoom: detail.source === "nepal",
        skipWhenLocalZoom: detail.source === "nepal",
        clickHint: "Click to zoom in",
        onClick:
          detail.source === "nepal"
            ? (feature) => {
                ensureNepalDistrictsLoaded();
                zoomToBounds(
                  featureBounds(feature),
                  NEPAL_DISTRICT_FULL_ZOOM,
                  8,
                );
              }
            : undefined,
      });
    }
  }

  function bindNepalDistrictHandlers() {
    if (nepalDistrictHandlersBound) return;
    nepalDistrictHandlersBound = true;
    bindRegionHandler(NEPAL_DISTRICT_MAP, {
      skipWhenLocalZoom: true,
      clickHint: "Click to zoom in",
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

  function ensureDetailLoaded() {
    if (detailLoaded || !map?.isStyleLoaded()) return;
    detailLoaded = true;

    for (const [id, source] of Object.entries(detailSources(format))) {
      addSourceTracked(id, source);
    }
    for (const layer of detailLayers(format)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    bindDetailHandlers();
    // Preload all Nepal layers so each level fades in smoothly as zoom increases.
    ensureNepalDistrictsLoaded();
    ensureNepalLocalLoaded();
  }

  function ensureNepalOverlaysLoaded() {
    if (atDetailZoom()) ensureDetailLoaded();
    if (atNepalDistrictZoom()) ensureNepalDistrictsLoaded();
    if (atNepalLocalZoom()) ensureNepalLocalLoaded();
    reportStats();
  }

  function ensureNepalDistrictsLoaded() {
    if (nepalDistrictsLoaded || !map?.isStyleLoaded()) return;
    nepalDistrictsLoaded = true;

    for (const [id, source] of Object.entries(nepalDistrictSources(format))) {
      addSourceTracked(id, source);
    }
    for (const layer of nepalDistrictLayers(format)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    bindNepalDistrictHandlers();
  }

  function ensureNepalLocalLoaded() {
    if (nepalLocalLoaded || !map?.isStyleLoaded()) return;
    nepalLocalLoaded = true;

    for (const [id, source] of Object.entries(nepalLocalSources(format))) {
      addSourceTracked(id, source);
    }
    for (const layer of nepalLocalLayers(format)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    bindNepalLocalHandlers();
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

    // Wheel and trackpad pinch use different rates in MapLibre — set both for consistent zoom.
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
      ensureNepalOverlaysLoaded();
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
      if (atDetailZoom()) {
        clearCountryHover();
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

      const props = feature.properties;
      const name = countryName(props);
      const hint = hasDetailMap(props) ? "<br><em>Click to explore</em>" : "";
      popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>${hint}`).addTo(map);
    });

    map.on("mouseleave", "world-countries-fill", () => {
      if (atDetailZoom()) return;
      map.getCanvas().style.cursor = "";
      clearCountryHover();
      popup.remove();
    });

    map.on("zoom", () => {
      ensureNepalOverlaysLoaded();
      if (atDetailZoom()) clearCountryHover();
    });

    map.on("click", "world-countries-fill", (e) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const props = feature.properties;
      const bounds = featureBounds(feature);
      const isNepal =
        props.adm0_a3 === "NPL" ||
        props.ADM0_A3 === "NPL" ||
        props.formal_en === "Nepal" ||
        props.FORMAL_EN === "Nepal";

      const camera = map.cameraForBounds(bounds, {
        padding: 60,
        maxZoom: isNepal ? 7.5 : 6.5,
      });

      if (!camera) return;

      viewMode = "country";

      if (hasDetailMap(props)) {
        camera.zoom = Math.max(camera.zoom, DETAIL_ZOOM);
        ensureDetailLoaded();
      }

      map.easeTo({ ...camera, duration: 500, essential: true });
      map.once("moveend", () => ensureNepalOverlaysLoaded());
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
</style>

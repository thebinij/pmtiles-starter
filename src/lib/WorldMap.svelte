<script>
  import { onMount, onDestroy } from "svelte";
  import maplibregl from "maplibre-gl";
  import { Protocol } from "pmtiles";
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    WORLD_BOUNDS,
    WORLD_FIT_PADDING,
    WORLD_MAX_ZOOM,
    buildMapStyle,
    countryClickBounds,
    countryClickZoom,
    countryFitOptions,
    countryPopupHtml,
    isUsaCountry,
    usaCountryCamera,
    featureStateTarget,
    worldMeta,
  } from "./mapConfig.js";
  import { createOverlayManager } from "./overlayManager.js";
  import { collectMapStats, createGeojsonLoadTracker } from "./mapStats.js";

  /** @type {'geojson' | 'pmtiles'} */
  let { format, onStats = () => {} } = $props();

  const geojsonTracker =
    format === "geojson" ? createGeojsonLoadTracker() : null;

  let mapContainer;
  let map;
  let popup;
  /** @type {ReturnType<typeof createOverlayManager> | null} */
  let overlayManager = null;
  let hoveredCountryId = null;
  let hoveredRegion = null;

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

  function inDetailView() {
    return overlayManager?.inDetailView() ?? false;
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

  function ensureOverlaysLoaded() {
    overlayManager?.ensureOverlaysLoaded();
    reportStats();
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

    popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    overlayManager = createOverlayManager({
      map,
      format,
      popup,
      trackSource: trackGeojsonSource,
      zoomToBounds,
      onHoverClear: clearCountryHover,
      setRegionHover: (target, feature) => {
        if (
          hoveredRegion &&
          (hoveredRegion.id !== feature.id ||
            hoveredRegion.source !== target.source)
        ) {
          clearRegionHover();
        }
        if (feature.id !== undefined) {
          hoveredRegion = target;
          map.setFeatureState(target, { hover: true });
        }
      },
      clearRegionHover: dismissHoverUI,
    });

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

    let overlayFrame = null;
    function scheduleOverlaysLoaded() {
      if (overlayFrame != null) return;
      overlayFrame = requestAnimationFrame(() => {
        overlayFrame = null;
        ensureOverlaysLoaded();
      });
    }

    map.on("move", () => {
      updateMapPosition();
      scheduleOverlaysLoaded();
    });
    map.on("zoomend", () => {
      updateMapPosition();
      ensureOverlaysLoaded();
      reportStats();
    });

    map.on("moveend", ensureOverlaysLoaded);

    map.on("sourcedata", (e) => {
      overlayManager?.onSourceData(e.sourceId, e.isSourceLoaded);
      reportStats();
    });

    const statsTimer = setInterval(reportStats, 2000);

    let resizeTimer;
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!inDetailView()) fitWorldView();
      }, 150);
    });
    resizeObserver.observe(mapContainer);

    map.on("mousemove", "world-countries-fill", (e) => {
      if (inDetailView()) {
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
      if (inDetailView()) return;
      dismissHoverUI();
    });

    map.on("zoom", () => {
      scheduleOverlaysLoaded();
      if (inDetailView()) dismissHoverUI();
    });

    map.on("click", "world-countries-fill", (e) => {
      if (inDetailView()) return;
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

      const clickZoom = countryClickZoom(props);
      if (clickZoom != null && !isUsaCountry(props)) camera.zoom = clickZoom;

      map.easeTo({ ...camera, duration: 500, essential: true });
      map.once("moveend", () => {
        dismissHoverUI();
        ensureOverlaysLoaded();
      });
    });

    return () => {
      if (overlayFrame != null) cancelAnimationFrame(overlayFrame);
      clearTimeout(resizeTimer);
      clearInterval(statsTimer);
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    reportStats();
    overlayManager?.destroy();
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

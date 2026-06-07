<script>
  import { tick } from "svelte";
  import maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    OVERLAY_TIERS,
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
  import {
    MOBILE_TAP_HINT,
    featureTapKey,
    isMobileMap,
    mapLibreOptions,
  } from "./mapPerformance.js";

  let { format, onStats = () => {} } = $props();

  let mapContainer = $state(null);

  let centerLng = $state(0);
  let centerLat = $state(20);
  let mapZoom = $state(1);
  let pointerLng = $state(null);
  let pointerLat = $state(null);

  const cursorCoords = $derived(
    pointerLat == null || pointerLng == null
      ? null
      : `lat: ${pointerLat.toFixed(5)}, lon: ${pointerLng.toFixed(5)}`,
  );
  const centerCoords = $derived(
    `lat: ${centerLat.toFixed(5)}, lon: ${centerLng.toFixed(5)}`,
  );
  const zoomLabel = $derived(`zoom: ${mapZoom.toFixed(1)}`);

  let map = null;

  function syncHud() {
    if (!map) return;
    const center = map.getCenter();
    centerLng = center.lng;
    centerLat = center.lat;
    mapZoom = map.getZoom();
  }

  function setPointer(lng, lat) {
    pointerLng = lng;
    pointerLat = lat;
  }

  function clearPointer() {
    pointerLng = null;
    pointerLat = null;
  }

  $effect(() => {
    const node = mapContainer;
    const fmt = format;
    if (!node) return;

    let destroyed = false;
    let teardown = null;

    tick().then(() => {
      if (destroyed || mapContainer !== node) return;

      const geojsonTracker =
        fmt === "geojson" ? createGeojsonLoadTracker() : null;
      const worldLayer = worldMeta(fmt).sourceLayer;

      const touchMode = isMobileMap();
      let overlayManager = null;
      let hoveredCountryId = null;
      let hoveredRegion = null;
      let selectedCountryKey = null;

      function reportStats() {
        onStats(collectMapStats(fmt, geojsonTracker));
      }

      function trackGeojsonSource(source) {
        geojsonTracker?.markSource(source);
      }

      function setCountryHover(featureId, active) {
        if (featureId === undefined) return;
        map.setFeatureState(
          featureStateTarget("world", worldLayer, featureId),
          { hover: active },
        );
      }

      function clearCountryHover() {
        if (hoveredCountryId === null) return;
        setCountryHover(hoveredCountryId, false);
        hoveredCountryId = null;
      }

      function clearRegionHover() {
        if (!hoveredRegion || !map) return;
        map.setFeatureState({ ...hoveredRegion }, { hover: false });
        hoveredRegion = null;
      }

      function dismissHoverUI() {
        selectedCountryKey = null;
        clearCountryHover();
        clearRegionHover();
        popup.remove();
        if (map) map.getCanvas().style.cursor = "";
      }

      function flyToCountry(feature, props) {
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
      }

      function interactiveFillLayers() {
        const layers = ["world-countries-fill"];
        for (const tier of OVERLAY_TIERS) {
          if (map.getLayer(tier.fillLayer)) layers.push(tier.fillLayer);
        }
        return layers;
      }

      function inDetailView() {
        return overlayManager?.inDetailView() ?? false;
      }

      function fitWorldView(duration = 0) {
        map?.fitBounds(WORLD_BOUNDS, {
          padding: WORLD_FIT_PADDING,
          duration,
          maxZoom: WORLD_MAX_ZOOM,
        });
      }

      map = new maplibregl.Map({
        container: node,
        style: buildMapStyle(fmt),
        center: [0, 20],
        zoom: 1,
        renderWorldCopies: false,
        ...mapLibreOptions(),
      });

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

      const zoomRate = 1 / 280;
      map.scrollZoom.setWheelZoomRate(zoomRate);
      map.scrollZoom.setZoomRate(zoomRate);
      map.touchZoomRotate.setZoomRate(1.5);

      const popup = new maplibregl.Popup({
        closeButton: touchMode,
        closeOnClick: false,
        offset: touchMode ? 16 : 12,
        maxWidth: touchMode ? "240px" : "280px",
        className: touchMode ? "map-popup-touch" : "",
      });

      if (touchMode) {
        popup.on("close", () => {
          selectedCountryKey = null;
          overlayManager?.clearTouchSelection();
          dismissHoverUI();
        });
      }

      overlayManager = createOverlayManager({
        map,
        format: fmt,
        popup,
        trackSource: fmt === "geojson" ? trackGeojsonSource : () => {},
        zoomToBounds,
        onHoverClear: () => {
          selectedCountryKey = null;
          clearCountryHover();
        },
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

      syncHud();

      map.on("error", (e) => {
        console.error("MapLibre error:", e.error);
      });

      map.on("move", syncHud);
      map.on("zoom", () => {
        syncHud();
        if (inDetailView()) dismissHoverUI();
      });

      map.on("mousemove", (e) => setPointer(e.lngLat.lng, e.lngLat.lat));
      map.on("mouseleave", clearPointer);
      if (touchMode) {
        map.on("touchstart", (e) => {
          if (e.lngLat) setPointer(e.lngLat.lng, e.lngLat.lat);
        });
      }

      map.on("zoomend", () => {
        syncHud();
        ensureOverlaysLoaded();
        reportStats();
      });

      map.on("moveend", () => {
        syncHud();
        ensureOverlaysLoaded();
      });

      if (fmt === "pmtiles") {
        map.on("idle", () => overlayManager?.ensureOverlaysLoaded());
      }

      map.on("sourcedata", (e) => {
        overlayManager?.onSourceData(e.sourceId);
        reportStats();
      });

      const statsTimer = setInterval(reportStats, 2000);

      const resizeObserver = new ResizeObserver(() => {
        map.resize();
        syncHud();
      });
      resizeObserver.observe(node);

      if (!touchMode) {
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
            setCountryHover(feature.id, true);
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
      }

      map.on("click", "world-countries-fill", (e) => {
        if (inDetailView()) return;
        if (!e.features?.length) return;

        const feature = e.features[0];
        const props = feature.properties;
        const tapKey = featureTapKey("world-countries-fill", feature);

        if (touchMode) {
          if (selectedCountryKey === tapKey) {
            dismissHoverUI();
            flyToCountry(feature, props);
            return;
          }

          overlayManager?.clearTouchSelection();
          clearRegionHover();
          popup.remove();

          if (hoveredCountryId !== null && hoveredCountryId !== feature.id) {
            clearCountryHover();
          }
          selectedCountryKey = tapKey;
          if (feature.id !== undefined) {
            hoveredCountryId = feature.id;
            setCountryHover(feature.id, true);
          }

          popup
            .setLngLat(e.lngLat)
            .setHTML(countryPopupHtml(props, { hint: MOBILE_TAP_HINT }))
            .addTo(map);
          return;
        }

        dismissHoverUI();
        flyToCountry(feature, props);
      });

      if (touchMode) {
        map.on("click", (e) => {
          const layers = interactiveFillLayers().filter((id) => map.getLayer(id));
          if (!layers.length) return;
          const hits = map.queryRenderedFeatures(e.point, { layers });
          if (hits.length) return;
          overlayManager?.clearTouchSelection();
          dismissHoverUI();
        });
      }

      const onLoad = () => {
        if (fmt === "geojson") {
          trackGeojsonSource({
            type: "geojson",
            data: "/geojsons/world.geojson",
          });
        }
        map.resize();
        fitWorldView();
        syncHud();
        ensureOverlaysLoaded();
        reportStats();
      };

      if (map.loaded()) onLoad();
      else map.once("load", onLoad);

      teardown = () => {
        clearInterval(statsTimer);
        resizeObserver.disconnect();
        popup.remove();
        overlayManager?.destroy();
        map.remove();
        map = null;
        reportStats();
      };
    });

    return () => {
      destroyed = true;
      teardown?.();
    };
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

  :global(.maplibregl-popup-content .popup-hint) {
    display: block;
    margin-top: 0.35rem;
    font-size: 11px;
    color: #64748b;
  }

  :global(.map-popup-touch .maplibregl-popup-content) {
    padding: 12px 16px;
    font-size: 15px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgb(26 43 60 / 18%);
  }

  :global(.map-popup-touch .maplibregl-popup-close-button) {
    width: 2rem;
    height: 2rem;
    font-size: 1.25rem;
    padding: 0;
  }

  @media (max-width: 640px) {
    .map-footer {
      flex-wrap: wrap;
      font-size: 0.62rem;
      padding: 0.35rem 0.5rem;
    }
  }
</style>

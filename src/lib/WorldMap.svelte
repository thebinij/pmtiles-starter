<script>
  import { onMount, onDestroy } from "svelte";
  import maplibregl from "maplibre-gl";
  import { Protocol } from "pmtiles";
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    DETAIL_MAPS,
    DETAIL_ZOOM,
    WORLD_BOUNDS,
    WORLD_FIT_PADDING,
    WORLD_MAX_ZOOM,
    buildMapStyle,
    countryName,
    detailLayers,
    detailSourceLayer,
    detailSources,
    featureLabel,
    featureStateTarget,
    hasDetailMap,
    worldMeta,
  } from "./mapConfig.js";

  /** @type {'geojson' | 'pmtiles'} */
  let { format } = $props();

  let mapContainer;
  let map;
  let popup;
  let hoveredCountryId = null;
  let hoveredRegion = null;
  let viewMode = "world";
  let detailLoaded = false;
  let detailHandlersBound = false;
  let loading = $state(true);
  let loadMs = $state(null);

  const worldSourceLayer = $derived(worldMeta(format).sourceLayer);
  const detailSl = $derived(detailSourceLayer(format));

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

  function fitWorldView(duration = 0) {
    map.fitBounds(WORLD_BOUNDS, {
      padding: WORLD_FIT_PADDING,
      duration,
      maxZoom: WORLD_MAX_ZOOM,
    });
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

  function bindDetailHandlers() {
    if (detailHandlersBound) return;
    detailHandlersBound = true;

    for (const detail of Object.values(DETAIL_MAPS)) {
      bindDetailHandler(detail);
    }
  }

  function bindDetailHandler(detail) {
    const { fillLayer, source } = detail;

    map.on("mousemove", fillLayer, (e) => {
      if (!atDetailZoom() || !e.features?.length) return;
      clearCountryHover();
      map.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      const target = featureStateTarget(source, detailSl, feature.id);
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
      popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>`).addTo(map);
    });

    map.on("mouseleave", fillLayer, () => {
      map.getCanvas().style.cursor = "";
      clearRegionHover();
      popup.remove();
    });
  }

  function ensureDetailLoaded() {
    if (detailLoaded || !map?.isStyleLoaded()) return;
    detailLoaded = true;

    for (const [id, source] of Object.entries(detailSources(format))) {
      if (!map.getSource(id)) map.addSource(id, source);
    }
    for (const layer of detailLayers(format)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    bindDetailHandlers();
  }

  onMount(() => {
    const start = performance.now();
    let ready = false;

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

    map.scrollZoom.setWheelZoomRate(1 / 280);

    map.once("load", () => fitWorldView());

    map.on("zoomend", () => {
      if (atDetailZoom()) ensureDetailLoaded();
    });

    map.once("idle", () => {
      if (!ready) {
        ready = true;
        loadMs = Math.round(performance.now() - start);
        loading = false;
      }
    });

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
      if (atDetailZoom()) clearCountryHover();
    });

    map.on("click", "world-countries-fill", (e) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const props = feature.properties;
      const bounds = featureBounds(feature);
      const camera = map.cameraForBounds(bounds, {
        padding: 60,
        maxZoom: 6.5,
      });

      if (!camera) return;

      viewMode = "country";

      if (hasDetailMap(props)) {
        camera.zoom = Math.max(camera.zoom, DETAIL_ZOOM);
        ensureDetailLoaded();
      }

      map.easeTo({ ...camera, duration: 500, essential: true });
    });

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    popup?.remove();
    map?.remove();
  });
</script>

<div class="wrap">
  <div class="map" bind:this={mapContainer}></div>

  <div class="status" class:geojson={format === "geojson"} class:pmtiles={format === "pmtiles"}>
    {#if loading}
      <span class="pulse">Loading…</span>
    {:else if loadMs !== null}
      <span>Ready in <strong>{(loadMs / 1000).toFixed(2)}s</strong></span>
    {/if}
  </div>
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .map {
    width: 100%;
    height: 100%;
  }

  .status {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    background: rgb(255 255 255 / 92%);
    border: 1px solid #c5d5e4;
    box-shadow: 0 2px 8px rgb(26 43 60 / 10%);
    pointer-events: none;
  }

  .status.geojson strong {
    color: #dc2626;
  }

  .status.pmtiles strong {
    color: #059669;
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }

  :global(.maplibregl-popup-content) {
    padding: 10px 14px;
    font-size: 14px;
  }
</style>

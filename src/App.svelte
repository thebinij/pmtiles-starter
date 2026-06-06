<script>
  import WorldMap from "./lib/WorldMap.svelte";
  import { FORMAT_META } from "./lib/mapConfig.js";

  let tab = $state("geojson");
</script>

<div class="page">
  <header class="header">
    <div class="brand">
      <img class="logo" src="/favicon.svg" alt="" width="32" height="32" />
      <h1>PMTiles Starter</h1>
    </div>
  </header>

  <main class="content">
    <div class="tabs" role="tablist">
      {#each Object.entries(FORMAT_META) as [key, meta] (key)}
        <button
          class="tab"
          class:active={tab === key}
          role="tab"
          aria-selected={tab === key}
          onclick={() => (tab = key)}
        >
          {meta.label}
          <span class="tab-tag">{meta.tagline}</span>
        </button>
      {/each}
    </div>

    <div class="tab-detail" class:geojson={tab === "geojson"} class:pmtiles={tab === "pmtiles"}>
      <p class="tab-hint">{FORMAT_META[tab].hint}</p>
      <ul class="tab-points">
        {#each FORMAT_META[tab].points as point}
          <li>{point}</li>
        {/each}
      </ul>
    </div>

    <div class="map-panel">
      {#key tab}
        <WorldMap format={tab} />
      {/key}
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    background: #f0f4f8;
    color: #1a2b3c;
  }

  .page {
    min-height: 100vh;
    padding: 1.25rem 1rem;
    box-sizing: border-box;
  }

  .header {
    max-width: 1400px;
    margin: 0 auto 1.25rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo {
    flex-shrink: 0;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .content {
    max-width: 1400px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding: 0.6rem 1rem;
    border: 1px solid #c5d5e4;
    border-radius: 10px 10px 0 0;
    background: #e8eef4;
    color: #5a6b7d;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab:hover {
    background: #dfe8f0;
  }

  .tab.active {
    background: #fff;
    color: #1a2b3c;
    border-bottom-color: #fff;
    margin-bottom: -1px;
    z-index: 1;
  }

  .tab-tag {
    font-size: 0.72rem;
    font-weight: 500;
    color: #7a8b9d;
  }

  .tab.active .tab-tag {
    color: #5a6b7d;
  }

  .tab-detail {
    margin-bottom: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #c5d5e4;
    background: #fff;
  }

  .tab-detail.geojson {
    border-left: 3px solid #dc2626;
  }

  .tab-detail.pmtiles {
    border-left: 3px solid #059669;
  }

  .tab-hint {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: #3d4f63;
    line-height: 1.45;
  }

  .tab-points {
    margin: 0;
    padding-left: 1.2rem;
    font-size: 0.8rem;
    color: #5a6b7d;
    line-height: 1.5;
  }

  .tab-points li + li {
    margin-top: 0.15rem;
  }

  .map-panel {
    width: 100%;
    height: min(72vh, 640px);
    min-height: 400px;
    border-radius: 0 12px 12px 12px;
    overflow: hidden;
    background: #dce8f2;
    border: 1px solid #c5d5e4;
    box-shadow:
      0 1px 2px rgb(26 43 60 / 6%),
      0 8px 24px rgb(26 43 60 / 8%);
  }
</style>

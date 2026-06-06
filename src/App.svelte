<script>
  import { onMount } from "svelte";
  import WorldMap from "./lib/WorldMap.svelte";
  import { FORMAT_META } from "./lib/mapConfig.js";
  import { formatBytes } from "./lib/mapStats.js";
  import { pathFromTab, tabFromPath } from "./lib/routes.js";

  let tab = $state(tabFromPath(window.location.pathname));

  /** @param {'geojson' | 'pmtiles'} next */
  function navigateTab(next) {
    tab = next;
    const path = pathFromTab(next);
    if (window.location.pathname !== path) {
      history.pushState({ tab: next }, "", path);
    }
  }

  onMount(() => {
    const onPopState = () => {
      tab = tabFromPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });

  /** @type {Record<'geojson' | 'pmtiles', import('./lib/mapStats.js').MapStats | null>} */
  let statsByFormat = $state({ geojson: null, pmtiles: null });

  /** @param {import('./lib/mapStats.js').MapStats} stats */
  function handleStats(stats) {
    statsByFormat = { ...statsByFormat, [stats.format]: stats };
  }

  const activeStats = $derived(statsByFormat[tab]);
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
        <a
          href={pathFromTab(key)}
          class="tab"
          class:active={tab === key}
          role="tab"
          aria-selected={tab === key}
          onclick={(e) => {
            e.preventDefault();
            navigateTab(key);
          }}
        >
          {meta.label}
          <span class="tab-tag">{meta.tagline}</span>
        </a>
      {/each}
    </div>

    <details class="tab-detail" class:geojson={tab === "geojson"} class:pmtiles={tab === "pmtiles"}>
      <summary class="tab-summary">
        <span>{FORMAT_META[tab].label} — when to use it</span>
        <span class="chevron" aria-hidden="true"></span>
      </summary>
      <div class="tab-body">
        <p class="tab-hint">{FORMAT_META[tab].hint}</p>
        <div class="tab-cols">
          <div>
            <h3 class="tab-col-title">Best for</h3>
            <ul class="tab-points">
              {#each FORMAT_META[tab].bestFor as point}
                <li>{point}</li>
              {/each}
            </ul>
          </div>
          <div>
            <h3 class="tab-col-title">Not ideal for</h3>
            <ul class="tab-points muted">
              {#each FORMAT_META[tab].notIdealFor as point}
                <li>{point}</li>
              {/each}
            </ul>
          </div>
        </div>

        <section class="stats-panel" aria-label="Browser usage">
          <h3 class="stats-title">Browser usage (this session)</h3>
          <dl class="stats-metrics">
            <div class="stats-row">
              <dt>Data loaded{#if activeStats?.estimated} <span class="stats-est">est.</span>{/if}</dt>
              <dd>{activeStats ? formatBytes(activeStats.networkBytes) : "—"}</dd>
            </div>
            <div class="stats-row">
              <dt>Map files</dt>
              <dd>{activeStats?.filesLoaded ?? "—"}</dd>
            </div>
            <div class="stats-row">
              <dt>JS heap</dt>
              <dd>
                {#if activeStats?.heapAvailable}
                  {formatBytes(activeStats.heapBytes)}
                {:else if activeStats}
                  n/a <span class="stats-note">(Chrome / Edge)</span>
                {:else}
                  —
                {/if}
              </dd>
            </div>
          </dl>
          <p class="stats-hint">
            {#if tab === "geojson"}
              GeoJSON file sizes are estimated when each source is added - MapLibre loads them in a Web Worker.
            {:else}
              PMTiles counts bytes from tile requests on the network.
            {/if}
          </p>
        </section>
      </div>
    </details>

    <div class="map-panel">
      {#key tab}
        <WorldMap format={tab} onStats={handleStats} />
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
    text-decoration: none;
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
    border-radius: 8px;
    border: 1px solid #c5d5e4;
    background: #fff;
    overflow: hidden;
  }

  .tab-detail.geojson {
    border-left: 3px solid #dc2626;
  }

  .tab-detail.pmtiles {
    border-left: 3px solid #059669;
  }

  .tab-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #3d4f63;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .tab-summary::-webkit-details-marker {
    display: none;
  }

  .chevron {
    width: 0.45rem;
    height: 0.45rem;
    border-right: 2px solid #7a8b9d;
    border-bottom: 2px solid #7a8b9d;
    transform: rotate(45deg);
    transition: transform 0.15s;
    flex-shrink: 0;
    margin-top: -0.15rem;
  }

  .tab-detail[open] .chevron {
    transform: rotate(-135deg);
    margin-top: 0.15rem;
  }

  .tab-body {
    padding: 0 1rem 0.75rem;
    border-top: 1px solid #e8eef4;
  }

  .tab-hint {
    margin: 0.65rem 0 0.75rem;
    font-size: 0.85rem;
    color: #3d4f63;
    line-height: 1.45;
  }

  .tab-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .tab-cols {
      grid-template-columns: 1fr;
    }
  }

  .tab-col-title {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #5a6b7d;
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

  .tab-points.muted {
    color: #7a8b9d;
  }

  .stats-panel {
    margin-top: 0.85rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e8eef4;
  }

  .stats-title {
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #5a6b7d;
  }

  .stats-metrics {
    margin: 0;
  }

  .stats-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .stats-row + .stats-row {
    margin-top: 0.1rem;
  }

  .stats-row dt {
    margin: 0;
    color: #7a8b9d;
  }

  .stats-est,
  .stats-note {
    font-size: 0.62rem;
    font-weight: 500;
    color: #94a3b8;
  }

  .stats-row dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
    color: #1a2b3c;
  }

  .stats-hint {
    margin: 0.45rem 0 0;
    font-size: 0.7rem;
    color: #7a8b9d;
    line-height: 1.4;
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

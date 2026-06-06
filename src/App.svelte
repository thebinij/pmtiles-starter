<script>
  import { onMount } from "svelte";
  import WorldMap from "./lib/WorldMap.svelte";
  import { FORMAT_META } from "./lib/mapConfig.js";
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
        </a>
      {/each}
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

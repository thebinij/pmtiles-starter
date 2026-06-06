# PMTiles Starter

A small example project showing **how to use PMTiles instead of GeoJSON** with MapLibre GL.

GeoJSON is easy to start with, but large boundary files are slow to download and parse in the browser. This repo demonstrates the full workflow: **GeoJSON → PMTiles → MapLibre**, with local dev and Cloudflare deployment.

**Suggested repo name:** `pmtiles-starter`  
**Suggested description:** *Example project showing how to convert GeoJSON to PMTiles and use them with MapLibre GL instead of raw GeoJSON.*

## Why PMTiles instead of GeoJSON?

| GeoJSON | PMTiles |
|---------|---------|
| Entire file downloaded upfront | Only needed byte ranges fetched |
| Parsed in the browser | Pre-tiled vector format |
| Slow for large admin boundaries | Fast for country / state / district data |
| Hard to host on static CDNs | Works with HTTP range requests |

PMTiles is a single-file archive. MapLibre reads only the tiles it needs via byte-range HTTP requests — no tile server required.

## What this demo shows

- **Side-by-side tabs** — same world map as GeoJSON vs PMTiles, with guidance on when each format fits
- Converting GeoJSON to `.pmtiles` with [tippecanoe](https://github.com/felt/tippecanoe)
- Loading PMTiles in MapLibre GL via the `pmtiles://` protocol
- Serving `.pmtiles` with **byte-range support** (required for PMTiles to work)
- Deploying tiles on **Cloudflare R2** + Worker (not Workers Assets)

## Project layout

```
geojsons/           # Source GeoJSON (input)
public/*.pmtiles    # Generated / pre-built PMTiles (output)
src/lib/mapConfig.js  # MapLibre style using pmtiles:/// URLs
worker/index.js     # Serves tiles from R2 with range headers
vite-plugin-pmtiles.js  # Byte-range serving for local dev
```

## GeoJSON → PMTiles

```bash
# Nepal & India examples
npm run tiles
```

This runs tippecanoe:

```bash
tippecanoe -o public/nepal.pmtiles --layer=provinces --generate-ids geojsons/nepal.geojson
tippecanoe -o public/nepal-districts.pmtiles --layer=districts --generate-ids geojsons/nepal-districts.geojson
tippecanoe -o public/india.pmtiles --layer=districts --generate-ids geojsons/india_state.geojson
```

`public/world.pmtiles` is pre-built. Add your own GeoJSON files and create matching `tiles:*` scripts.

## Use PMTiles in MapLibre

```js
import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";

const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  style: {
    sources: {
      world: {
        type: "vector",
        url: "pmtiles:///world.pmtiles",  // same-origin path
      },
    },
    layers: [/* ... */],
  },
});
```

See `src/lib/mapConfig.js` and `src/lib/WorldMap.svelte` for the full setup.

## Local development

```bash
npm install
npm run dev
```

The Vite plugin serves `.pmtiles` with HTTP byte-range support locally.

```bash
npm run build
npm run preview
```

## Deploy to Cloudflare

PMTiles **must** be served with byte-range support. Workers Assets cannot do this — use R2 + a Worker.

1. `npx wrangler login`
2. Create R2 bucket `worldmap-tiles`
3. Upload tiles (once, or when GeoJSON sources change):

```bash
npm run upload:tiles
```

4. Deploy the app:

```bash
npm run deploy
```

The build removes `.pmtiles` from `dist/` so only the Worker serves them from R2.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local dev with PMTiles byte-range support |
| `npm run tiles` | Convert example GeoJSON files to PMTiles |
| `npm run upload:tiles` | Upload `.pmtiles` to Cloudflare R2 |
| `npm run deploy` | Build and deploy Worker + app |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Prerequisites

- [Node.js](https://nodejs.org/)
- [tippecanoe](https://github.com/felt/tippecanoe) — to convert GeoJSON → PMTiles

## Adding more GeoJSON layers

1. Put GeoJSON in `geojsons/`
2. Add a `tiles:yourlayer` script in `package.json`
3. Upload with `npm run upload:tiles` (add the filename in `scripts/upload-tiles.mjs`)
4. Add a source + layers in `src/lib/mapConfig.js`

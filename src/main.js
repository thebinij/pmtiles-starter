import App from "./App.svelte";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { mount } from "svelte";

const pmtilesProtocol = new Protocol();
maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);

mount(App, { target: document.getElementById("app") });

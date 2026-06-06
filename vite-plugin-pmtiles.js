import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const geojsonDir = path.resolve(rootDir, "geojsons");

function pmtilesMiddleware(rootDir) {
  return (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    if (!url.endsWith(".pmtiles")) return next();

    const filePath = path.join(rootDir, decodeURIComponent(url));
    if (!fs.existsSync(filePath)) return next();

    const { size } = fs.statSync(filePath);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : size - 1;
        if (start >= size || end >= size) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${size}`);
          res.end();
          return;
        }

        const length = end - start + 1;
        res.statusCode = 206;
        res.setHeader("Content-Length", String(length));
        res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Length", String(size));
    fs.createReadStream(filePath).pipe(res);
  };
}

function geojsonMiddleware() {
  return (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    if (!url.startsWith("/geojsons/")) return next();
    if (!url.endsWith(".geojson") && !url.endsWith(".json")) return next();

    const filePath = path.join(geojsonDir, path.basename(url));
    if (!fs.existsSync(filePath)) return next();

    res.setHeader(
      "Content-Type",
      url.endsWith(".json") ? "application/json" : "application/geo+json",
    );
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  };
}

function prependMiddleware(stack, middleware) {
  stack.unshift({ route: "", handle: middleware });
}

export function pmtilesByteServing() {
  return {
    name: "pmtiles-byte-serving",
    configureServer(server) {
      const root = path.resolve("public");
      prependMiddleware(server.middlewares.stack, geojsonMiddleware());
      prependMiddleware(server.middlewares.stack, pmtilesMiddleware(root));
    },
    configurePreviewServer(server) {
      const root = path.resolve("public");
      prependMiddleware(server.middlewares.stack, geojsonMiddleware());
      prependMiddleware(server.middlewares.stack, pmtilesMiddleware(root));
    },
    closeBundle() {
      const dist = path.resolve("dist");
      for (const file of fs.readdirSync(dist)) {
        if (file.endsWith(".pmtiles")) {
          fs.unlinkSync(path.join(dist, file));
        }
      }
      fs.cpSync(geojsonDir, path.join(dist, "geojsons"), { recursive: true });
    },
  };
}

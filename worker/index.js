export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (!url.pathname.endsWith(".pmtiles")) {
      return env.ASSETS.fetch(request);
    }

    return serveTile(request, env, url.pathname.slice(1));
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, If-Match",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, ETag, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
  };
}

function parseByteRange(rangeHeader, size) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader ?? "");
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start >= size || end >= size || end < start) return null;

  return { start, end, length: end - start + 1 };
}

async function serveTile(request, env, key) {
  if (!env.TILES) {
    return new Response("R2 TILES binding missing — check wrangler.toml", { status: 500 });
  }

  const object = await env.TILES.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (object === null) {
    return new Response(`Tile not found in R2: ${key}`, { status: 404 });
  }

  const headers = new Headers(corsHeaders());
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  const range = parseByteRange(request.headers.get("Range"), object.size);
  if (range) {
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${object.size}`,
    );
    headers.set("Content-Length", String(range.length));
  }

  const hasBody = request.method !== "HEAD" && "body" in object && object.body !== null;
  const status = hasBody ? (range ? 206 : 200) : range ? 206 : 412;

  return new Response(hasBody ? object.body : undefined, { status, headers });
}

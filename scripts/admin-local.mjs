import http from "node:http";
import { parseEnv } from "node:util";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, extname, dirname, join } from "node:path";
import { createHandler } from "../server/admin.mjs";
import { ApiError } from "../server/github.mjs";

// Local sandbox storage. Never modifies the real posts.json or publishes to GitHub.
export class LocalStore {
  constructor(directory = ".admin-data") {
    this.directory = resolve(directory);
  }
  async snapshot(privateRepo = false) {
    return { privateRepo, repo: privateRepo ? "local/drafts" : "local/posts" };
  }
  location(snap, path) {
    const base = resolve(
      this.directory,
      snap.privateRepo ? "private" : "public",
    );
    const file = resolve(base, path);
    if (!file.startsWith(base + "/") && !file.startsWith(base + "\\"))
      throw new ApiError(400, "Ungültiger Pfad.");
    return file;
  }
  async read(snap, path, optional = false) {
    try {
      return JSON.parse(await readFile(this.location(snap, path), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      if (path === "wwwroot/data/posts.json")
        return JSON.parse(await readFile(resolve(path), "utf8"));
      if (optional) return null;
      throw new ApiError(404, "Datei nicht gefunden.");
    }
  }
  async commit(snap, files) {
    for (const file of files) {
      const target = this.location(snap, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(
        target + ".tmp",
        file.encoding === "base64"
          ? Buffer.from(file.content, "base64")
          : file.content,
      );
      await rename(target + ".tmp", target);
    }
    return "lokaler-test";
  }
}
if (process.env.NODE_ENV !== "test") {
  Object.assign(process.env, parseEnv(await readFile('.env.local', 'utf8')));
  const store = new LocalStore();
  const handler = createHandler(
    { ...process.env, LOCAL_EDITOR: "true" },
    { store },
  );
  const root = resolve("wwwroot");
  const builtRoot = resolve('.publish/wwwroot');
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    '.wasm': 'application/wasm', '.dat': 'application/octet-stream', '.pdb': 'application/octet-stream', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain',
  };
  const server = http.createServer(async (req, res) => {
    try {
      const origin = `http://${req.headers.host}`;
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith("/api/admin/")) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4200000) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(chunk);
        }
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(req.method !== "GET" ? { body: Buffer.concat(chunks) } : {}),
        });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      let path =
        url.pathname === "/admin" || url.pathname === "/admin/"
          ? "/admin/index.html"
          : url.pathname;
      const file = resolve(root, "." + decodeURIComponent(path));
      if (file !== root && !file.startsWith(root + "/") && !file.startsWith(root + "\\")) {
        res.writeHead(404);
        res.end();
        return;
      }
      let data;
      if (path === '/data/posts.json' || path.startsWith('/img/posts/')) {
        try { data = await readFile(store.location(await store.snapshot(), 'wwwroot'+path)); } catch(e) { if(e.code !== 'ENOENT')throw e; }
      }
      if (!data) {
        try { data = await readFile(file); }
        catch(e) {
          if (e.code !== 'ENOENT' && e.code !== 'EISDIR')throw e;
          if (path.startsWith('/_framework/')) data = await readFile(join(builtRoot,path));
          else if (!extname(path)) { path = '/index.html'; data=await readFile(join(root,path)); }
          else throw e;
        }
      }
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Nicht gefunden.");
    }
  });
  server.listen(Number(process.env.PORT || 5050), "127.0.0.1", () =>
    console.log(
      "Redaktion: http://localhost:" +
        (process.env.PORT || 5050) +
        "/admin (lokaler Test, keine GitHub-Veröffentlichung)",
    ),
  );
}

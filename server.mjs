import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DIST_DIR = path.join(__dirname, "dist");
const CARDS_PATH = path.join(DATA_DIR, "n4-cards.json");
const PROGRESS_PATH = path.join(DATA_DIR, "progress.json");
const PORT = 4173;
const HOST = "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function handleApi(req, res) {
  if (req.url === "/api/session" && req.method === "GET") {
    sendJson(res, 200, { authenticated: true, authRequired: false });
    return true;
  }

  if (req.url === "/api/logout" && req.method === "POST") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.url === "/api/cards" && req.method === "GET") {
    const raw = fs.readFileSync(CARDS_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(raw);
    return true;
  }

  if (req.url === "/api/progress" && req.method === "GET") {
    if (!fs.existsSync(PROGRESS_PATH)) {
      sendJson(res, 200, { store: null });
      return true;
    }
    const raw = fs.readFileSync(PROGRESS_PATH, "utf8");
    sendJson(res, 200, { store: JSON.parse(raw) });
    return true;
  }

  if (req.url === "/api/progress" && req.method === "POST") {
    readBody(req)
      .then((raw) => {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1 || typeof parsed.cards !== "object") {
          sendJson(res, 400, { error: "Invalid progress payload" });
          return;
        }
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const tmpPath = `${PROGRESS_PATH}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(parsed, null, 2), "utf8");
        fs.renameSync(tmpPath, PROGRESS_PATH);
        sendJson(res, 200, { ok: true });
      })
      .catch((err) => {
        sendJson(res, 400, { error: err.message });
      });
    return true;
  }

  return false;
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("App not built yet. Run `npm run build` first.");
    return;
  }

  const reqPath = (req.url || "/").split("?")[0];
  const relPath = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const resolved = path.resolve(DIST_DIR, relPath);

  if (!resolved.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const target = fs.existsSync(resolved) && fs.statSync(resolved).isFile()
    ? resolved
    : path.join(DIST_DIR, "index.html");

  const ext = path.extname(target);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
}

function findAppBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function openAppWindow(url, onClose) {
  const browserPath = findAppBrowser();
  if (!browserPath) {
    console.log(`Open in browser: ${url}`);
    return;
  }
  const profileDir = path.join(
    process.env.LOCALAPPDATA || DATA_DIR,
    "jlpt-n4-srs-window"
  );
  const child = spawn(
    browserPath,
    [`--app=${url}`, `--user-data-dir=${profileDir}`, "--window-size=920,760"],
    { stdio: "ignore" }
  );
  if (onClose) child.on("exit", onClose);
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/") && handleApi(req, res)) return;
  serveStatic(req, res);
});

const isAppMode = process.argv.includes("--app");
const url = `http://${HOST}:${PORT}`;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && isAppMode) {
    // Another instance is already serving; open/focus window and exit this helper.
    openAppWindow(url);
    return;
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`JLPT N4 SRS running at ${url}`);
  if (isAppMode) {
    openAppWindow(url, () => {
      server.close(() => process.exit(0));
    });
  }
});

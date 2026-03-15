import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connect from "connect";
import serveStatic from "serve-static";
import { apiMiddleware } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

const app = connect();
app.use(apiMiddleware);
app.use(serveStatic(distDir));
// SPA fallback: serve index.html for non-file routes
app.use((_req, res) => {
  if (res.headersSent) return;
  res.setHeader("Content-Type", "text/html");
  fs.createReadStream(path.join(distDir, "index.html")).pipe(res);
});

const server = http.createServer(app);
server.listen(3000, "0.0.0.0", () => {
  console.log("Production server listening on http://0.0.0.0:3000");
});

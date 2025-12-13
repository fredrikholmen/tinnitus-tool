import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateSoundFiles } from "./soundGeneratorAPI.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wav": "audio/wav",
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // API endpoint for sound generation
  if (u.pathname.startsWith("/api/generate")) {
    if (req.method !== "POST") {
      res.writeHead(405, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const params = JSON.parse(body);
        const { 
          tinnitusHz, 
          mode = "phase", 
          minutes = 60,
          useAltActive = false,
          useAltSham = false 
        } = params;

        if (!tinnitusHz || tinnitusHz <= 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid tinnitusHz" }));
          return;
        }

        const result = await generateSoundFiles({
          tinnitusHz: Number(tinnitusHz),
          mode: String(mode),
          minutes: Number(minutes),
          useAltActive: Boolean(useAltActive),
          useAltSham: Boolean(useAltSham),
        });

        res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("Generation error:", error);
        res.writeHead(500, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for downloading generated files
  if (u.pathname.startsWith("/api/download/")) {
    const filename = u.pathname.replace("/api/download/", "");
    const filePath = path.join(__dirname, "generated", filename);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Serve static files from dist (Vite build output)
  let p = u.pathname === "/" ? "/index.html" : u.pathname;
  if (p.includes("..")) {
    res.writeHead(400);
    res.end("Bad path");
    return;
  }

  // Try dist first (production), then public (dev)
  const distPath = path.join(__dirname, "..", "dist", p);
  const publicPath = path.join(__dirname, "public", p);

  let filePath;
  if (fs.existsSync(distPath) && !fs.statSync(distPath).isDirectory()) {
    filePath = distPath;
  } else if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
    filePath = publicPath;
  } else {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = process.env.PORT || 3021;
server.listen(PORT, () => {
  console.log(`API server running: http://localhost:${PORT}`);
});

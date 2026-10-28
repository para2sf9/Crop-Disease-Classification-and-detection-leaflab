import "dotenv/config";
import dns from "node:dns";

// Resolve IPv4 addresses first on environments where IPv6 route is unreachable
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  identify,
  getIdentification,
  deleteIdentification,
  sendFeedback,
  usageInfo,
  sanitizePayload,
  PlantIdError,
  PLANT_ID_BASE_URL,
  providerConfiguration,
} from "./kindwise.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by ALLOWED_ORIGINS.`));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Base64 images are large; allow up to ~24 MB per request.
app.use(express.json({ limit: "24mb" }));

function fail(res, error) {
  const status = error instanceof PlantIdError ? error.status : 500;
  const code = error instanceof PlantIdError ? error.code : "internal_error";
  return res.status(status).json({
    error: error.message || "Unexpected server error.",
    code,
    detail: error.detail,
  });
}

function asyncRoute(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      if (!(error instanceof PlantIdError)) console.error("[leaflab]", error);
      fail(res, error);
    });
  };
}

/* ── Health & configuration ─────────────────────────────────────────── */

app.get("/api/health", (req, res) => {
  const providers = providerConfiguration();
  res.json({
    ok: true,
    upstream: PLANT_ID_BASE_URL,
    hasApiKey: providers.some((provider) => provider.hasApiKey),
    providers,
    time: new Date().toISOString(),
  });
});

/* ── Identification ─────────────────────────────────────────────────── */

app.post(
  "/api/identify",
  asyncRoute(async (req, res) => {
    const data = await identify(req.body || {}, {
      details: req.query.details ? String(req.query.details).split(",") : undefined,
      language: req.query.language ? String(req.query.language) : undefined,
    });
    res.json(data);
  })
);

app.get(
  "/api/identification/:token",
  asyncRoute(async (req, res) => {
    const data = await getIdentification(req.params.token, {
      details: req.query.details ? String(req.query.details).split(",") : undefined,
      language: req.query.language ? String(req.query.language) : undefined,
    });
    res.json(data);
  })
);

app.delete(
  "/api/identification/:token",
  asyncRoute(async (req, res) => {
    const data = await deleteIdentification(req.params.token);
    res.json({ deleted: true, upstream: data });
  })
);

app.post(
  "/api/identification/:token/feedback",
  asyncRoute(async (req, res) => {
    const data = await sendFeedback(req.params.token, req.body || {});
    res.json({ ok: true, upstream: data });
  })
);

app.get(
  "/api/usage",
  asyncRoute(async (req, res) => {
    res.json(await usageInfo());
  })
);

/** Dry-run payload validation so the UI can explain problems without spending credits. */
app.post("/api/validate", (req, res) => {
  try {
    const payload = sanitizePayload(req.body || {});
    res.json({
      ok: true,
      imageCount: payload.images.length,
      approxBytes: payload.images.reduce((sum, image) => sum + image.length, 0),
      fields: Object.keys(payload),
    });
  } catch (error) {
    fail(res, error);
  }
});

/** Pre-configured specimens for instant testing without manual file hunting */
app.get("/api/specimens", (req, res) => {
  res.json([
    {
      id: "tomato-late-blight",
      title: "Tomato Late Blight",
      crop: "Tomato (Solanum lycopersicum)",
      condition: "Late blight",
      scientificName: "Phytophthora infestans",
      url: "https://raw.githubusercontent.com/flowerchecker/crop-health-examples/master/images/example.jpg",
      badge: "Leaf image specimen",
    },
  ]);
});

/** Helper to fetch an image URL server-side and return as Base64 dataUrl */
app.post(
  "/api/fetch-specimen",
  asyncRoute(async (req, res) => {
    const url = req.body?.url;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Image URL is required" });
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch image: HTTP ${response.status}` });
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    res.json({
      dataUrl: `data:${contentType};base64,${base64}`,
      base64,
      bytes: arrayBuffer.byteLength,
      contentType,
    });
  })
);

/* ── Static production build (optional) ─────────────────────────────── */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`LeafLab proxy listening on http://localhost:${PORT}`);
  console.log(`Upstream: ${PLANT_ID_BASE_URL}`);
  if (!providerConfiguration().some((provider) => provider.hasApiKey)) {
    console.warn("No Plant.id API key is configured — set PLANT_ID_API_KEY in .env.");
  }
});

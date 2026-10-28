import dns from "node:dns";

// Ensure Node resolves IPv4 addresses first on systems with IPv6 routing gaps.
dns.setDefaultResultOrder("ipv4first");

/**
 * Thin, dependency-free client for the Plant.id identification API.
 * Docs: https://plant.id/
 *
 * This module runs ONLY on the server. The API key is read from the
 * environment so it never reaches the browser bundle.
 */

export const PLANT_ID_BASE_URL =
  process.env.PLANT_ID_BASE_URL || "https://plant.id/api/v3";

export const IDENTIFICATION_PATH = "/identification";

export function providerConfiguration() {
  return [
    {
      id: "plant-id",
      name: "Plant.id",
      baseUrl: PLANT_ID_BASE_URL,
      hasApiKey: Boolean((process.env.PLANT_ID_API_KEY || "").trim()),
    },
  ];
}

/** Fields requested from Plant.id for each suggestion. */
export const DEFAULT_DETAILS = [
  "description",
  "treatment",
  "symptoms",
  "severity",
  "spreading",
  "common_names",
  "taxonomy",
  "eppo_code",
  "wiki_url",
  "image",
];

export class PlantIdError extends Error {
  constructor(message, { status = 502, code = "upstream_error", detail } = {}) {
    super(message);
    this.name = "PlantIdError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Keep only payload keys the API documents, and normalise image entries to
 * raw Base64 strings (the API accepts Base64 with or without a data URL prefix,
 * but stripping it keeps the request small and predictable).
 */
export function sanitizePayload(body = {}) {
  const rawImages = Array.isArray(body.images) ? body.images : [];
  const maxImages = Number(process.env.MAX_IMAGES || 3);
  const images = rawImages
    .map((image) => String(image || "").trim())
    .map((image) => (image.startsWith("data:") ? image.slice(image.indexOf(",") + 1) : image))
    .filter(Boolean)
    .slice(0, maxImages);

  if (!images.length) {
    throw new PlantIdError("At least one Base64-encoded image is required.", {
      status: 400,
      code: "no_images",
    });
  }
  if (images.some((image) => image.length < 100)) {
    throw new PlantIdError("One of the images looks truncated or is not Base64 data.", {
      status: 400,
      code: "bad_image",
    });
  }

  // Plant.id accepts similar_images only when enabled.
  const payload = { images };
  if (body.similar_images) {
    payload.similar_images = true;
  }

  for (const key of ["latitude", "longitude"]) {
    const value = Number(body[key]);
    if (Number.isFinite(value)) payload[key] = value;
  }
  if (typeof body.datetime === "string" && body.datetime.trim()) {
    payload.datetime = body.datetime.trim();
  }
  if (body.custom_id !== undefined && body.custom_id !== null && body.custom_id !== "") {
    payload.custom_id = body.custom_id;
  }
  if (body.language) {
    payload.language = String(body.language).slice(0, 8);
  }
  return payload;
}

function detailsQuery(details) {
  const list = Array.isArray(details) && details.length ? details : DEFAULT_DETAILS;
  return [...new Set(list.filter(Boolean))].join(",");
}

/** Translate upstream status codes into messages a user can act on. */
function describeUpstream(status, body, providerName) {
  const upstreamMessage =
    typeof body === "string"
      ? body
      : body?.message || body?.error || body?.detail || `HTTP ${status} from ${providerName}.`;
  const map = {
    400: `${providerName} rejected the request: ${upstreamMessage}`,
    401: `${providerName} rejected the API key. Verify that it belongs to this provider.`,
    403: `This API key is not allowed to use ${providerName}. Check your plan or key scope.`,
    404: `The ${providerName} identification was not found. It may have expired.`,
    413: "The images are too large. Downscale to roughly 1600px on the long edge.",
    429: `${providerName} credits or rate limit exhausted. Check the provider account or plan.`,
    500: `${providerName} reported an internal error. Retry once, then inspect the detail.`,
    503: `${providerName} is temporarily unavailable. Retry with backoff.`,
  };
  return {
    message: map[status] || `Plant.id request failed: ${upstreamMessage}`,
    detail: upstreamMessage,
  };
}

async function callProvider(provider, path, { method = "GET", body, searchParams } = {}) {
  const url = new URL(provider.baseUrl.replace(/\/$/, "") + path);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const jsonString = body ? JSON.stringify(body) : undefined;
  const headers = {
    "Content-Type": "application/json",
    "Api-Key": provider.apiKey,
  };
  if (jsonString) {
    headers["Content-Length"] = String(Buffer.byteLength(jsonString));
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(45_000),
      headers,
      body: jsonString,
    });
  } catch (cause) {
    throw new PlantIdError(
      `Could not reach ${provider.name} (${cause?.message || "network error"}). Check outbound network access.`,
      { status: 502, code: "network_error", detail: cause?.message }
    );
  }

  let text;
  try {
    text = await response.text();
  } catch (cause) {
    throw new PlantIdError(
      `Could not read the ${provider.name} response (${cause?.message || "network error"}).`,
      { status: 502, code: "network_error", detail: cause?.message }
    );
  }
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const { message, detail } = describeUpstream(response.status, parsed, provider.name);
    throw new PlantIdError(message, {
      status: response.status,
      code: `upstream_${response.status}`,
      detail: `${provider.name}: ${detail}`,
    });
  }
  return parsed;
}

function plantIdProvider() {
  const [configuration] = providerConfiguration();
  const apiKey = (process.env.PLANT_ID_API_KEY || "").trim();
  return apiKey ? { ...configuration, apiKey } : null;
}

async function callPlantId(path, options = {}) {
  const provider = plantIdProvider();
  if (!provider) {
    throw new PlantIdError("PLANT_ID_API_KEY is not set.", {
      status: 500,
      code: "missing_api_key",
    });
  }
  return callProvider(provider, path, options);
}

/** POST /identification — returns access_token + crop/disease suggestions. */
export function identify(body, { details, language } = {}) {
  const payload = sanitizePayload(body);
  const provider = plantIdProvider();
  if (!provider) {
    throw new PlantIdError("PLANT_ID_API_KEY is not set.", {
      status: 500,
      code: "missing_api_key",
    });
  }
  return callProvider(provider, IDENTIFICATION_PATH, {
    method: "POST",
    body: { ...payload, health: "all" },
    searchParams: {
      details: detailsQuery(details),
      language: language || body.language || "en",
    },
  }).then((result) => ({ ...result, provider: provider.id, providerName: provider.name }));
}

/** GET /identification/{access_token} */
export function getIdentification(accessToken, { details, language } = {}) {
  if (!accessToken) {
    throw new PlantIdError("access_token is required.", { status: 400, code: "missing_token" });
  }
  return callPlantId(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}`, {
    searchParams: { details: detailsQuery(details), language: language || "en" },
  });
}

/** DELETE /identification/{access_token} */
export function deleteIdentification(accessToken) {
  return callPlantId(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}`, {
    method: "DELETE",
  });
}

/** POST /identification/{access_token}/feedback */
export function sendFeedback(accessToken, { rating, comment } = {}) {
  return callPlantId(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}/feedback`, {
    method: "POST",
    body: { rating: Number(rating), comment: String(comment || "") },
  });
}

/** GET /usage_info — credits used/remaining for the key. */
export function usageInfo() {
  return callPlantId("/usage_info");
}

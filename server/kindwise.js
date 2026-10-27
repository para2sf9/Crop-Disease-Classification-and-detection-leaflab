import dns from "node:dns";

// Ensure Node resolves IPv4 addresses first on systems with IPv6 routing gaps.
dns.setDefaultResultOrder("ipv4first");

/**
 * Thin, dependency-free client for the Kindwise Crop.health identification API.
 * Docs: https://crop.kindwise.com/docs
 *
 * This module runs ONLY on the server. The API key is read from the
 * environment so it never reaches the browser bundle.
 */

export const KINDWISE_BASE_URL =
  process.env.KINDWISE_BASE_URL || "https://crop.kindwise.com/api/v1";

export const PLANT_ID_BASE_URL =
  process.env.PLANT_ID_BASE_URL || "https://plant.id/api/v3";

export const IDENTIFICATION_PATH = "/identification";

export function providerConfiguration() {
  return [
    {
      id: "crop-health",
      name: "Crop.health",
      baseUrl: KINDWISE_BASE_URL,
      hasApiKey: Boolean((process.env.KINDWISE_API_KEY || "").trim()),
    },
    {
      id: "plant-id",
      name: "Plant.id",
      baseUrl: PLANT_ID_BASE_URL,
      hasApiKey: Boolean((process.env.PLANT_ID_API_KEY || "").trim()),
    },
  ];
}

/** Fields we ask Kindwise to attach to each suggestion. */
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

export class KindwiseError extends Error {
  constructor(message, { status = 502, code = "upstream_error", detail } = {}) {
    super(message);
    this.name = "KindwiseError";
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
    throw new KindwiseError("At least one Base64-encoded image is required.", {
      status: 400,
      code: "no_images",
    });
  }
  if (images.some((image) => image.length < 100)) {
    throw new KindwiseError("One of the images looks truncated or is not Base64 data.", {
      status: 400,
      code: "bad_image",
    });
  }

  // Kindwise Crop.health rejects "similar_images: false" with HTTP 400:
  // "Unknown modifier: similar_images=false. Available modifiers: [similar_images=true]".
  // Therefore, only include similar_images when explicitly true.
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
    message: map[status] || `Kindwise request failed: ${upstreamMessage}`,
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
    throw new KindwiseError(
      `Could not reach ${provider.name} (${cause?.message || "network error"}). Check outbound network access.`,
      { status: 502, code: "network_error", detail: cause?.message }
    );
  }

  let text;
  try {
    text = await response.text();
  } catch (cause) {
    throw new KindwiseError(
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
    throw new KindwiseError(message, {
      status: response.status,
      code: `upstream_${response.status}`,
      detail: `${provider.name}: ${detail}`,
    });
  }
  return parsed;
}

function providerFromEnv(id) {
  const configuration = providerConfiguration().find((provider) => provider.id === id);
  const key = id === "crop-health"
    ? (process.env.KINDWISE_API_KEY || "").trim()
    : (process.env.PLANT_ID_API_KEY || "").trim();
  return configuration && key ? { ...configuration, apiKey: key } : null;
}

function canFailOver(error) {
  return (
    error.code === "network_error" ||
    error.code === "missing_api_key" ||
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
}

async function identifyWithFailover(payload, searchParams) {
  const primary = providerFromEnv("crop-health");
  const fallback = providerFromEnv("plant-id");

  if (!primary && !fallback) {
    throw new KindwiseError(
      "No provider API keys are configured. Set KINDWISE_API_KEY or PLANT_ID_API_KEY in .env.",
      { status: 500, code: "missing_api_key" }
    );
  }

  if (!primary) {
    const result = await callProvider(fallback, IDENTIFICATION_PATH, {
      method: "POST",
      body: { ...payload, health: "all" },
      searchParams,
    });
    return { ...result, provider: fallback.id, providerName: fallback.name };
  }

  try {
    const result = await callProvider(primary, IDENTIFICATION_PATH, {
      method: "POST",
      body: payload,
      searchParams,
    });
    return { ...result, provider: primary.id, providerName: primary.name };
  } catch (primaryError) {
    if (!fallback || !canFailOver(primaryError)) throw primaryError;
    try {
      const result = await callProvider(fallback, IDENTIFICATION_PATH, {
        method: "POST",
        body: { ...payload, health: "all" },
        searchParams,
      });
      return { ...result, provider: fallback.id, providerName: fallback.name };
    } catch (fallbackError) {
      throw new KindwiseError(
        `Both providers failed. Crop.health: ${primaryError.message} Plant.id: ${fallbackError.message}`,
        {
          status: fallbackError.status || 502,
          code: fallbackError.code || "provider_failover_failed",
          detail: fallbackError.detail,
        }
      );
    }
  }
}

async function callKindwise(path, options = {}) {
  const provider = providerFromEnv("crop-health");
  if (!provider) {
    throw new KindwiseError("KINDWISE_API_KEY is not set.", {
      status: 500,
      code: "missing_api_key",
    });
  }
  return callProvider(provider, path, options);
}

/** POST /identification — returns access_token + crop/disease suggestions. */
export function identify(body, { details, language } = {}) {
  const payload = sanitizePayload(body);
  return identifyWithFailover(payload, {
    details: detailsQuery(details),
    language: language || body.language || "en",
  });
}

/** GET /identification/{access_token} */
export function getIdentification(accessToken, { details, language } = {}) {
  if (!accessToken) {
    throw new KindwiseError("access_token is required.", { status: 400, code: "missing_token" });
  }
  return callKindwise(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}`, {
    searchParams: { details: detailsQuery(details), language: language || "en" },
  });
}

/** DELETE /identification/{access_token} */
export function deleteIdentification(accessToken) {
  return callKindwise(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}`, {
    method: "DELETE",
  });
}

/** POST /identification/{access_token}/feedback */
export function sendFeedback(accessToken, { rating, comment } = {}) {
  return callKindwise(`${IDENTIFICATION_PATH}/${encodeURIComponent(accessToken)}/feedback`, {
    method: "POST",
    body: { rating: Number(rating), comment: String(comment || "") },
  });
}

/** GET /usage_info — credits used/remaining for the key. */
export function usageInfo() {
  return callKindwise("/usage_info");
}

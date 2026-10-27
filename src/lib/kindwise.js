/**
 * Fetch wrappers around the local /api proxy.
 *
 * The browser never sees either provider key: every call goes to the Express
 * proxy in server/index.js, which attaches the selected Api-Key server-side.
 */

const BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const error = new Error(body?.error || `Request failed with HTTP ${response.status}.`);
    error.code = body?.code;
    error.detail = body?.detail;
    error.status = response.status;
    throw error;
  }
  return body;
}

export const checkHealth = () => request("/health");

export const identify = (payload) =>
  request("/identify", { method: "POST", body: JSON.stringify(payload) });

export const validatePayload = (payload) =>
  request("/validate", { method: "POST", body: JSON.stringify(payload) });

export const getIdentification = (token, { details, language } = {}) => {
  const params = new URLSearchParams();
  if (details?.length) params.set("details", details.join(","));
  if (language) params.set("language", language);
  const suffix = params.toString() ? `?${params}` : "";
  return request(`/identification/${encodeURIComponent(token)}${suffix}`);
};

export const deleteIdentification = (token) =>
  request(`/identification/${encodeURIComponent(token)}`, { method: "DELETE" });

export const sendFeedback = (token, { rating, comment }) =>
  request(`/identification/${encodeURIComponent(token)}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });

export const fetchUsage = () => request("/usage");

export const fetchSpecimens = () => request("/specimens");

export const fetchSpecimenImage = (url) =>
  request("/fetch-specimen", { method: "POST", body: JSON.stringify({ url }) });

/**
 * Normalise Crop.health and Plant.id responses into the shape the UI renders.
 * Defensive: fields may be null when a detail is unavailable for an entity.
 */
export function normalizeResult(raw) {
  const result = raw?.result || {};
  const cropSuggestions = Array.isArray(result.crop?.suggestions)
    ? result.crop.suggestions
    : Array.isArray(result.classification?.suggestions)
      ? result.classification.suggestions
      : [];

  const healthDiseases = result.health_assessment?.diseases;
  const diseaseSuggestions = Array.isArray(result.disease?.suggestions)
    ? result.disease.suggestions
    : Array.isArray(healthDiseases)
      ? healthDiseases
      : [];

  const byProbability = (a, b) => Number(b.probability || 0) - Number(a.probability || 0);

  const sortedDiseases = [...diseaseSuggestions].sort(byProbability).map((item) => {
    const details = item.details || {};
    // Normalize treatment into structured categories: chemical, biological, prevention
    const rawTreatment = details.treatment;
    let treatment = { chemical: [], biological: [], prevention: [] };
    if (rawTreatment && typeof rawTreatment === "object" && !Array.isArray(rawTreatment)) {
      const chem = rawTreatment.chemical || rawTreatment["chemical treatment"] || rawTreatment.chemical_treatment;
      const bio = rawTreatment.biological || rawTreatment["biological treatment"] || rawTreatment.biological_treatment;
      const prev = rawTreatment.prevention || rawTreatment["prevention treatment"] || rawTreatment.prevention_treatment;
      treatment = {
        chemical: Array.isArray(chem) ? chem : chem ? [chem] : [],
        biological: Array.isArray(bio) ? bio : bio ? [bio] : [],
        prevention: Array.isArray(prev) ? prev : prev ? [prev] : [],
      };
    } else if (typeof rawTreatment === "string" && rawTreatment.trim()) {
      treatment.prevention = [rawTreatment];
    }

    return {
      ...item,
      treatment,
      referenceImage: details.image?.value || (Array.isArray(details.images) ? details.images[0]?.value : null),
      citation: details.image?.citation || null,
      commonNames: Array.isArray(details.common_names) ? details.common_names : [],
      taxonomy: details.taxonomy || null,
      eppoCode: details.eppo_code || null,
      wikiUrl: details.wiki_url || null,
      description: details.description || details.wiki_description || "",
      symptoms: typeof details.symptoms === "string" ? details.symptoms : details.symptoms?.description || "",
      severity: details.severity || null,
      spreading: details.spreading || null,
    };
  });

  const sortedCrops = [...cropSuggestions].sort(byProbability);

  const isHealthyBinary =
    result.is_healthy?.binary === true ||
    result.is_healthy === true ||
    Number(result.is_healthy_probability || 0) >= 0.5 ||
    (sortedDiseases.length > 0 &&
      String(sortedDiseases[0]?.name || "").toLowerCase().trim() === "healthy" &&
      Number(sortedDiseases[0]?.probability || 0) >= 0.5);

  return {
    accessToken: raw?.access_token || "",
    provider: raw?.provider || "",
    providerName: raw?.providerName || (raw?.provider === "plant-id" ? "Plant.id" : "Crop.health"),
    modelVersion: raw?.model_version || "",
    crop: sortedCrops,
    disease: sortedDiseases,
    isPlant: result.is_plant ? {
      binary: result.is_plant.binary ?? true,
      probability: Number(result.is_plant.probability || 1),
    } : null,
    isHealthy: isHealthyBinary,
    question: result.disease?.question || null,
    raw,
  };
}

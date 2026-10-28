/**
 * Fetch wrappers around the local /api proxy.
 *
 * The browser never sees the Plant.id API key: every call goes to the Express
 * proxy in server/index.js, which attaches it server-side.
 */

const BASE = "/api";
export const MIN_DISPLAY_CONFIDENCE = 0.7;

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

function textValue(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    return textValue(value.value ?? value.name ?? value.description ?? "");
  }
  return "";
}

function textList(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(textValue).filter(Boolean);
}

/**
 * Normalise Plant.id responses into the shape the UI renders.
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

  const sortedDiseases = diseaseSuggestions
    .filter((item) => item && typeof item === "object")
    .sort(byProbability)
    .map((item) => {
      const details = item.details && typeof item.details === "object" ? item.details : {};
      // Normalize treatment into structured categories: chemical, biological, prevention
      const rawTreatment = details.treatment;
      let treatment = { chemical: [], biological: [], prevention: [] };
      if (rawTreatment && typeof rawTreatment === "object" && !Array.isArray(rawTreatment)) {
        const chem = rawTreatment.chemical || rawTreatment["chemical treatment"] || rawTreatment.chemical_treatment;
        const bio = rawTreatment.biological || rawTreatment["biological treatment"] || rawTreatment.biological_treatment;
        const prev = rawTreatment.prevention || rawTreatment["prevention treatment"] || rawTreatment.prevention_treatment;
        treatment = {
          chemical: textList(chem),
          biological: textList(bio),
          prevention: textList(prev),
        };
      } else if (typeof rawTreatment === "string" && rawTreatment.trim()) {
        treatment.prevention = [rawTreatment];
      }
      const rawTaxonomy = details.taxonomy;

      return {
        ...item,
        treatment,
        name: textValue(item.name) || "Unnamed condition",
        scientific_name: textValue(item.scientific_name),
        referenceImage: textValue(details.image?.value) || textValue(details.images?.[0]?.value) || null,
        citation: textValue(details.image?.citation) || null,
        commonNames: textList(details.common_names),
        taxonomy: rawTaxonomy && typeof rawTaxonomy === "object"
          ? Object.fromEntries(
              Object.entries(rawTaxonomy).map(([key, value]) => [key, textValue(value)])
            )
          : null,
        eppoCode: textValue(details.eppo_code) || null,
        wikiUrl: textValue(details.wiki_url) || null,
        description: textValue(details.description) || textValue(details.wiki_description),
        symptoms: textValue(details.symptoms),
        severity: textValue(details.severity) || null,
        spreading: textValue(details.spreading) || null,
      };
    });

  const sortedCrops = cropSuggestions
    .filter((item) => item && typeof item === "object")
    .sort(byProbability)
    .map((item) => ({
      ...item,
      name: textValue(item.name) || "Unknown crop",
      scientific_name: textValue(item.scientific_name),
    }));
  const rawQuestion = result.disease?.question || result.health_assessment?.question;
  const question = rawQuestion && typeof rawQuestion === "object"
    ? {
        text: textValue(rawQuestion.text),
        options: Array.isArray(rawQuestion.options)
          ? rawQuestion.options.map((option) => ({
              name: textValue(option?.name ?? option),
            })).filter((option) => option.name)
          : [],
      }
    : null;

  const isHealthyBinary =
    (result.is_healthy?.binary === true &&
      Number(result.is_healthy.probability || 0) >= MIN_DISPLAY_CONFIDENCE) ||
    Number(result.is_healthy_probability || 0) >= MIN_DISPLAY_CONFIDENCE ||
    (sortedDiseases.length > 0 &&
      String(sortedDiseases[0]?.name || "").toLowerCase().trim() === "healthy" &&
      Number(sortedDiseases[0]?.probability || 0) >= MIN_DISPLAY_CONFIDENCE);

  return {
    accessToken: raw?.access_token || "",
    provider: raw?.provider || "",
    providerName: raw?.providerName || "Plant.id",
    modelVersion: raw?.model_version || "",
    crop: sortedCrops,
    disease: sortedDiseases,
    isPlant: result.is_plant ? {
      binary: result.is_plant.binary ?? true,
      probability: Number(result.is_plant.probability || 1),
    } : null,
    isHealthy: isHealthyBinary,
    question,
    raw,
  };
}

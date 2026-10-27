import { useRef, useState, useEffect } from "react";
import { identify, fetchUsage, fetchSpecimens, fetchSpecimenImage } from "../lib/kindwise.js";
import { prepareImage, validateImageFile } from "../lib/image.js";

const SAMPLE_RESPONSE = {
  access_token: "sample-token-demo-mode",
  model_version: "crop_health:1.2.1-demo",
  result: {
    is_plant: { binary: true, probability: 0.998 },
    crop: {
      suggestions: [
        {
          id: "crop-tomato",
          name: "Tomato",
          scientific_name: "Solanum lycopersicum",
          probability: 0.965,
        },
      ],
    },
    disease: {
      suggestions: [
        {
          id: "disease-late-blight",
          name: "Late blight",
          scientific_name: "Phytophthora infestans",
          probability: 0.9596,
          details: {
            description:
              "Late blight is a devastating plant disease caused by the oomycete Phytophthora infestans. It primarily infects potatoes and tomatoes, causing rapid leaf lesions, dark stem necrosis, and tuber rot.",
            symptoms:
              "Irregular water-soaked lesions appear on leaves, rapidly turning dark brown or purplish with pale green halos. A white fungal-like growth often appears on the leaf undersides in humid conditions.",
            severity: "High",
            spreading: "Airborne sporangia and wind-driven rain",
            common_names: [
              "Late Blight of Potato",
              "Late Blight of Tomato",
              "Potato Blight",
            ],
            eppo_code: "PHYTIN",
            wiki_url: "https://en.wikipedia.org/wiki/Phytophthora_infestans",
            image: {
              value:
                "https://raw.githubusercontent.com/flowerchecker/crop-health-examples/master/images/example.jpg",
              citation: "Kindwise Benchmark Specimen",
            },
            treatment: {
              prevention: [
                "Plant certified disease-free seed potatoes and resistant tomato cultivars.",
                "Ensure generous plant spacing to maximize air circulation and reduce canopy humidity.",
                "Avoid overhead irrigation; water at soil level in early mornings.",
                "Destroy volunteer potato plants and cull piles before the growing season.",
              ],
              biological: [
                "Apply Bacillus subtilis or Bacillus amyloliquefaciens biofungicides preventatively.",
                "Use copper octanoate or copper soap formulations approved for organic production.",
              ],
              chemical: [
                "Apply protective contact fungicides (mancozeb, chlorothalonil) prior to infection periods.",
                "For active infections, rotate systemic fungicides with differing FRAC modes of action (e.g. cyazofamid, fluopicolide, mandipropamid).",
              ],
            },
            taxonomy: {
              kingdom: "Chromista",
              phylum: "Oomycota",
              class: "Oomycetes",
              order: "Peronosporales",
              family: "Peronosporaceae",
              genus: "Phytophthora",
            },
          },
        },
        {
          id: "disease-early-blight",
          name: "Early blight",
          scientific_name: "Alternaria solani",
          probability: 0.038,
          details: {
            description: "Common fungal disease causing concentric target-ring spots on older foliage.",
            symptoms: "Brown-to-black circular spots with concentric rings resembling a target board.",
            severity: "Moderate",
            treatment: {
              prevention: ["Rotate crops out of Solanaceae family for 2–3 years.", "Mulch base of plants."],
            },
          },
        },
        {
          id: "disease-septoria",
          name: "Septoria leaf spot",
          scientific_name: "Septoria lycopersici",
          probability: 0.002,
          details: {
            description: "Fungal leaf spot characterized by circular lesions with gray centers and dark margins.",
          },
        },
      ],
    },
  },
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPanel({
  image,
  onImage,
  onResult,
  onBusy,
  onError,
  onNotice,
  busy,
  serverState,
  providers = [],
  usage,
  onUsage,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingSpecimen, setLoadingSpecimen] = useState(false);
  const [specimens, setSpecimens] = useState([]);

  useEffect(() => {
    fetchSpecimens()
      .then((data) => {
        if (Array.isArray(data)) setSpecimens(data);
      })
      .catch(() => {});
  }, []);

  const chooseFile = async (file) => {
    onError("");
    onNotice("");
    if (!file) return;
    const validation = validateImageFile(file);
    if (validation) {
      onError(validation);
      return;
    }
    setLoadingImage(true);
    try {
      const prepared = await prepareImage(file);
      onImage({ ...prepared, name: file.name, originalBytes: file.size });
      onNotice(
        `Image prepared: ${prepared.width} × ${prepared.height} px (${formatBytes(prepared.bytes)}).`
      );
    } catch (error) {
      onError(error.message || "The image could not be processed.");
    } finally {
      setLoadingImage(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const loadPresetSpecimen = async (specimen) => {
    onError("");
    onNotice("");
    setLoadingSpecimen(true);
    try {
      const fetched = await fetchSpecimenImage(specimen.url);
      const img = new Image();
      img.src = fetched.dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      onImage({
        dataUrl: fetched.dataUrl,
        base64: fetched.base64,
        name: `${specimen.title}.jpg`,
        width: img.width,
        height: img.height,
        bytes: fetched.bytes,
      });
      onNotice(`Loaded preset specimen: "${specimen.title}". Ready for live identification.`);
    } catch (err) {
      onError(`Failed to load specimen image: ${err.message}`);
    } finally {
      setLoadingSpecimen(false);
    }
  };

  const runIdentification = async () => {
    if (!image?.base64) {
      onError("Choose or drop a leaf image before requesting an identification.");
      return;
    }
    onBusy(true);
    onError("");
    onNotice("");
    try {
      const response = await identify({
        images: [image.base64],
      });
      onResult(response, "live");
      onNotice(
        `✓ Diagnosis complete! Result received from ${response.providerName || "Kindwise Crop.health"}.`
      );
      try {
        const accountUsage = await fetchUsage();
        onUsage(accountUsage);
      } catch {
        // Usage endpoint may be plan-specific; ignore if not returned
      }
    } catch (error) {
      onError(`${error.message}${error.detail ? ` Detail: ${error.detail}` : ""}`);
    } finally {
      onBusy(false);
    }
  };

  const loadSample = () => {
    onResult(SAMPLE_RESPONSE, "sample");
    onNotice("Sample preview loaded. Illustrative benchmark data without calling the API.");
    onError("");
  };

  const keyReady = serverState === "ready";
  const configuredProviders = providers.filter((p) => p.hasApiKey);
  const failoverReady = configuredProviders.length > 1;
  const blocked = busy || loadingImage || loadingSpecimen || !image || !keyReady;

  const remainingCredits = usage?.remaining?.total ?? usage?.remaining?.month ?? 50;

  return (
    <article className="card reveal upload-card">
      <div className="card-head">
        <div>
          <div className="sub">01 / SPECIMEN INPUT</div>
          <h2 style={{ marginTop: ".25rem" }}>Upload & Analyze Leaf</h2>
        </div>
        <div className="credit-pill-wrapper">
          <span className="pill pill-live" title="Remaining credits for this API key">
            💳 {remainingCredits} credits available
          </span>
        </div>
      </div>

      {/* Preset specimen quick-pick */}
      <div className="specimen-presets-box">
        <div className="presets-label">
          <span>⚡ Instant Test Specimens (1-Click Load):</span>
        </div>
        <div className="presets-grid">
          {specimens.map((spec) => (
            <button
              key={spec.id}
              type="button"
              className="preset-btn"
              disabled={busy || loadingSpecimen}
              onClick={() => loadPresetSpecimen(spec)}
            >
              <span className="preset-icon">🍅</span>
              <div className="preset-details">
                <strong>{spec.title}</strong>
                <small>{spec.crop}</small>
              </div>
              <span className="preset-badge">Verified</span>
            </button>
          ))}
          <button
            type="button"
            className="preset-btn ghost"
            disabled={busy}
            onClick={loadSample}
          >
            <span className="preset-icon">🔬</span>
            <div className="preset-details">
              <strong>Sample Preview</strong>
              <small>No credits consumed</small>
            </div>
            <span className="preset-badge demo">Offline</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`drop ${dragging ? "over" : ""} ${image ? "has-image" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop a crop leaf image"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {image ? (
          <div className="preview-container">
            <img
              className="thumb"
              src={image.dataUrl}
              alt={`Selected leaf: ${image.name}`}
            />
            <div className="preview-info">
              <strong className="image-filename">{image.name}</strong>
              <div className="image-specs">
                <span>{image.width} × {image.height} px</span>
                <span>•</span>
                <span>{formatBytes(image.bytes)}</span>
              </div>
              <span className="change-hint">Click or drop to replace</span>
            </div>
          </div>
        ) : (
          <div className="drop-prompt">
            <div className="plus" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="big">Drop your crop leaf photo here</div>
            <div className="hint">or click to browse from device • JPEG, PNG, WebP</div>
            <div className="drop-tips">
              <span>✓ Clear close-up of leaf</span>
              <span>✓ Good lighting</span>
              <span>✓ Single leaf preferred</span>
            </div>
          </div>
        )}

        {(loadingImage || loadingSpecimen) && (
          <div className="drop-loading">
            <span className="spinner" /> {loadingSpecimen ? "Fetching specimen from library…" : "Preparing & optimizing image…"}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      {/* Provider Connectivity Banner */}
      <div className="provider-status-strip">
        <div className="provider-indicator">
          <span className={`status-dot ${keyReady ? "ready" : serverState === "offline" ? "error" : ""}`} />
          <div className="provider-text">
            <strong>
              {keyReady
                ? failoverReady
                  ? "Kindwise Failover Engine Active (Crop.health + Plant.id)"
                  : `${configuredProviders[0]?.name || "Kindwise"} Connected`
                : serverState === "offline"
                ? "Local Proxy Offline"
                : "Checking Connection…"}
            </strong>
            <small>
              {keyReady
                ? "Primary: Crop.health v1 • Automatic failover to Plant.id v3. API keys secured server-side."
                : "Connecting to http://localhost:8787 proxy..."}
            </small>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="button-row upload-actions" style={{ marginTop: "1.2rem" }}>
        <button
          className="btn analyze-btn"
          type="button"
          disabled={blocked}
          onClick={runIdentification}
        >
          {busy ? (
            <>
              <span className="spinner" /> &nbsp;Analyzing with Kindwise AI…
            </>
          ) : (
            <>
              🔍 Analyze Crop Leaf
            </>
          )}
        </button>

        <button
          className="btn ghost tiny"
          type="button"
          disabled={!keyReady || busy}
          onClick={async () => {
            onError("");
            try {
              const accountUsage = await fetchUsage();
              onUsage(accountUsage);
              onNotice("Kindwise account usage metrics updated.");
            } catch (err) {
              onError(err.message);
            }
          }}
        >
          {usage ? "Refresh Usage" : "Check Credits"}
        </button>

        {image && (
          <button
            className="btn danger tiny"
            type="button"
            disabled={busy}
            onClick={() => onImage(null)}
          >
            Clear Image
          </button>
        )}
      </div>
    </article>
  );
}

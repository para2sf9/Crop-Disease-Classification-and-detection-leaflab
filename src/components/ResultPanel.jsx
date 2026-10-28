import { useState } from "react";
import { percent } from "../lib/metrics.js";
import { MIN_DISPLAY_CONFIDENCE } from "../lib/kindwise.js";

function TreatmentSection({ treatment }) {
  const [activeTab, setActiveTab] = useState("prevention");

  const hasPrevention = treatment.prevention && treatment.prevention.length > 0;
  const hasBiological = treatment.biological && treatment.biological.length > 0;
  const hasChemical = treatment.chemical && treatment.chemical.length > 0;

  if (!hasPrevention && !hasBiological && !hasChemical) return null;

  return (
    <div className="treatment-card">
      <div className="treatment-header">
        <div className="treatment-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Recommended Management & Treatment</span>
        </div>
        <div className="treatment-tabs" role="tablist">
          {hasPrevention && (
            <button
              type="button"
              className={`t-tab ${activeTab === "prevention" ? "active" : ""}`}
              onClick={() => setActiveTab("prevention")}
            >
              🛡️ Prevention
            </button>
          )}
          {hasBiological && (
            <button
              type="button"
              className={`t-tab ${activeTab === "biological" ? "active" : ""}`}
              onClick={() => setActiveTab("biological")}
            >
              🌿 Biological
            </button>
          )}
          {hasChemical && (
            <button
              type="button"
              className={`t-tab ${activeTab === "chemical" ? "active" : ""}`}
              onClick={() => setActiveTab("chemical")}
            >
              🧪 Chemical
            </button>
          )}
        </div>
      </div>

      <div className="treatment-content">
        {activeTab === "prevention" && hasPrevention && (
          <ul className="treatment-list">
            {treatment.prevention.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {activeTab === "biological" && hasBiological && (
          <ul className="treatment-list">
            {treatment.biological.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {activeTab === "chemical" && hasChemical && (
          <div>
            <ul className="treatment-list">
              {treatment.chemical.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <div className="safety-disclaimer">
              ⚠️ <em>Chemical controls should always comply with local agricultural regulations and manufacturer labels. Consult a certified agronomist before application.</em>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Candidate({ suggestion, index }) {
  const probability = Math.max(0, Math.min(1, Number(suggestion.probability) || 0));
  const hasReference = Boolean(suggestion.referenceImage);
  const commonNames = suggestion.commonNames || [];

  return (
    <div className="candidate">
      <div className="candidate-head">
        <span className="candidate-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="candidate-name">
          <strong>{suggestion.name || "Unnamed condition"}</strong>
          {suggestion.scientific_name && <em>{suggestion.scientific_name}</em>}
        </div>
        <span className="score">{percent(probability)}</span>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${probability * 100}%`,
            background:
              probability > 0.7
                ? "linear-gradient(90deg, #10b981, #059669)"
                : probability > 0.3
                ? "linear-gradient(90deg, #f59e0b, #d97706)"
                : "linear-gradient(90deg, #64748b, #475569)",
          }}
        />
      </div>

      {(suggestion.description || suggestion.symptoms || hasReference || commonNames.length > 0) && (
        <details className="detail-fold">
          <summary>Diagnostic Details & Reference</summary>
          <div className="detail-fold-body">
            {hasReference && (
              <div className="specimen-preview-thumb">
                <img
                  src={suggestion.referenceImage}
                  alt={`Reference: ${suggestion.name}`}
                  className="reference-mini-img"
                  loading="lazy"
                />
                {suggestion.citation && <span className="citation-text">Ref: {suggestion.citation}</span>}
              </div>
            )}
            {commonNames.length > 0 && (
              <div className="detail-row">
                <span className="detail-key">Aliases:</span>
                <span className="detail-val">{commonNames.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {suggestion.description && (
              <p className="detail-desc">{suggestion.description}</p>
            )}
            {suggestion.symptoms && (
              <div className="detail-symptoms">
                <strong>Symptoms:</strong> {suggestion.symptoms}
              </div>
            )}
            {suggestion.treatment && <TreatmentSection treatment={suggestion.treatment} />}
          </div>
        </details>
      )}
    </div>
  );
}

export default function ResultPanel({
  result,
  origin,
  image,
  busy,
  knownLabel,
  onKnownLabel,
  onRecord,
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeView, setActiveView] = useState("diagnostic"); // "diagnostic" | "comparison"

  const suggestions = (result?.disease || []).filter(
    (suggestion) => Number(suggestion.probability) >= MIN_DISPLAY_CONFIDENCE
  );
  const topCandidate = suggestions[0];
  const crop = result?.crop?.find(
    (suggestion) => Number(suggestion.probability) >= MIN_DISPLAY_CONFIDENCE
  );
  const isSample = origin === "sample";

  const handleCopyToken = () => {
    if (!result?.accessToken) return;
    navigator.clipboard?.writeText(result.accessToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const QUICK_LABELS = [
    "Healthy",
    "Late blight",
    "Early blight",
    "Leaf spot",
    "Powdery mildew",
    "Rust",
    "Bacterial spot",
  ];

  return (
    <article className="card reveal result-panel-card">
      <div className="card-head">
        <div>
          <div className="sub">02 / DIAGNOSTIC RESULT</div>
          <h2 style={{ marginTop: ".25rem" }}>Pathology & Crop Assessment</h2>
        </div>
        {result && (
          <div className="topbar-actions">
            <span className={`pill ${isSample ? "pill-demo" : "pill-live"}`}>
              {isSample ? "Sample response" : `${result.providerName || "Plant.id"} ${result.modelVersion || "API"}`}
            </span>
            {(result.isHealthy === true || topCandidate) && (
              <span className={`pill ${result.isHealthy ? "pill-live" : "pill-demo"}`}>
                {result.isHealthy ? "🌿 Healthy" : "⚠️ Pathology Detected"}
              </span>
            )}
          </div>
        )}
      </div>

      {!result ? (
        <div className="empty empty-state-box">
          {busy ? (
            <div className="analyzing-state">
              <span className="spinner large" />
              <div className="analyzing-text">
                <h3>Evaluating Specimen with Plant.id</h3>
                <p>Running neural network analysis across 300+ crop diseases & pests...</p>
              </div>
            </div>
          ) : (
            <div className="empty-content">
              <div className="empty-icon-circle">🍃</div>
              <div className="empty-title">Specimen Ready for Analysis</div>
              <p>Upload a leaf image or select a pre-loaded sample specimen to run identification.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {isSample && (
            <div className="note-box warn" style={{ marginBottom: ".9rem" }}>
              ⚠️ Illustrative sample data for interface preview. This is not live model output.
            </div>
          )}

          {/* Plant Identification Strip */}
          {crop && (
            <div className="crop-banner">
              <div className="crop-icon-badge">🌱</div>
              <div className="crop-info">
                <span className="sub">IDENTIFIED CROP HOST · ≥70% CONFIDENCE</span>
                <div className="crop-names">
                  <strong>{crop.name}</strong>
                  {crop.scientific_name && <em>{crop.scientific_name}</em>}
                </div>
              </div>
              <div className="crop-badge-side">
                <span className="crop-prob-chip">{percent(crop.probability)} Match</span>
                {result.isPlant && (
                  <span className="plant-verified-tag">
                    {result.isPlant.binary ? "✓ Plant Confirmed" : "Non-plant detected"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Top Verdict Hero Card */}
          {topCandidate ? (
            <div className={`verdict-hero ${Number(topCandidate.probability) < 0.5 ? "verdict-low" : ""}`}>
              <div className="verdict-top">
                <div className="verdict-title-group">
                  <div className="verdict-eyebrow">
                    <span className="chip primary">PRIMARY DIAGNOSIS · ≥70% CONFIDENCE</span>
                    {topCandidate.severity && (
                      <span className={`severity-chip severity-${topCandidate.severity.toLowerCase()}`}>
                        Severity: {topCandidate.severity}
                      </span>
                    )}
                    {topCandidate.eppoCode && (
                      <a
                        href={`https://gd.eppo.int/taxon/${topCandidate.eppoCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="eppo-link"
                        title="EPPO Global Database entry"
                      >
                        EPPO: {topCandidate.eppoCode} ↗
                      </a>
                    )}
                  </div>
                  <h3 className="verdict-name">{topCandidate.name}</h3>
                  {topCandidate.scientific_name && (
                    <div className="verdict-latin">{topCandidate.scientific_name}</div>
                  )}
                </div>

                <div className="verdict-score-gauge">
                  <div className="score-ring">
                    <span className="score-number">{percent(topCandidate.probability)}</span>
                    <span className="score-label">Confidence</span>
                  </div>
                </div>
              </div>

              {/* Common Aliases */}
              {topCandidate.commonNames && topCandidate.commonNames.length > 0 && (
                <div className="common-names-row">
                  <span className="aliases-label">Also known as:</span>
                  {topCandidate.commonNames.slice(0, 4).map((name, idx) => (
                    <span key={idx} className="alias-pill">{name}</span>
                  ))}
                </div>
              )}

              {/* Visual Side-by-Side Reference Preview */}
              {(image?.dataUrl || topCandidate.referenceImage) && (
                <div className="specimen-compare-box">
                  <div className="compare-header">
                    <span>Visual Evidence Comparison</span>
                    <div className="compare-toggle">
                      <button
                        type="button"
                        className={`toggle-btn ${activeView === "diagnostic" ? "active" : ""}`}
                        onClick={() => setActiveView("diagnostic")}
                      >
                        Side by Side
                      </button>
                      {topCandidate.wikiUrl && (
                        <a
                          href={topCandidate.wikiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="wiki-link-btn"
                        >
                          Wiki Profile ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="compare-frames">
                    {image?.dataUrl && (
                      <div className="compare-frame">
                        <div className="frame-tag">Uploaded Specimen</div>
                        <img src={image.dataUrl} alt="Submitted leaf" className="frame-img" />
                        <span className="frame-meta">{image.name || "Specimen"}</span>
                      </div>
                    )}
                    {topCandidate.referenceImage ? (
                      <div className="compare-frame">
                        <div className="frame-tag reference">Plant.id Reference Library</div>
                        <img
                          src={topCandidate.referenceImage}
                          alt={`Reference for ${topCandidate.name}`}
                          className="frame-img"
                        />
                        <span className="frame-meta">
                          {topCandidate.citation ? `Source: ${topCandidate.citation}` : "Verified Reference"}
                        </span>
                      </div>
                    ) : (
                      <div className="compare-frame reference empty-frame">
                        <div className="empty-ref-text">Reference library image not available for this taxon.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description & Symptoms */}
              {topCandidate.description && (
                <div className="verdict-summary-box">
                  <p>{topCandidate.description}</p>
                </div>
              )}

              {topCandidate.symptoms && (
                <div className="symptoms-box">
                  <strong>Pathological Symptoms:</strong> {topCandidate.symptoms}
                </div>
              )}

              {/* Taxonomy Breadcrumb */}
              {topCandidate.taxonomy && (
                <div className="taxonomy-strip">
                  <span className="tax-label">Taxonomy:</span>
                  {topCandidate.taxonomy.kingdom && <span className="tax-node">{topCandidate.taxonomy.kingdom}</span>}
                  {topCandidate.taxonomy.phylum && <span className="tax-node">{topCandidate.taxonomy.phylum}</span>}
                  {topCandidate.taxonomy.class && <span className="tax-node">{topCandidate.taxonomy.class}</span>}
                  {topCandidate.taxonomy.family && <span className="tax-node">{topCandidate.taxonomy.family}</span>}
                  {topCandidate.taxonomy.genus && <span className="tax-node">{topCandidate.taxonomy.genus}</span>}
                </div>
              )}

              {/* Actionable Treatment Tabs */}
              {topCandidate.treatment && <TreatmentSection treatment={topCandidate.treatment} />}
            </div>
          ) : (
            <div className="note-box warn">
              No diagnosis met the 70% confidence threshold. Try a clearer, well-lit leaf photo.
            </div>
          )}

          {/* Plant.id Differential Question if returned */}
          {result.question && (
            <div className="diagnostic-question-card">
              <div className="question-badge">❓ Follow-up Diagnostic Question</div>
              <p className="question-text">{result.question.text}</p>
              {result.question.options && (
                <div className="question-options">
                  {result.question.options.map((opt, i) => (
                    <button key={i} type="button" className="btn ghost tiny">
                      {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Ranked Condition Candidates */}
          {suggestions.length > 1 && (
            <div className="ranked-candidates-section">
              <div className="section-label-row">
                <span className="sub">DIFFERENTIAL DIAGNOSES ({suggestions.length - 1} Candidates ≥70%)</span>
                <span className="note">Only diagnoses at or above 70% confidence are shown</span>
              </div>
              <div className="candidate-list">
                {suggestions.slice(1, 6).map((suggestion, index) => (
                  <Candidate
                    key={suggestion.id || `${suggestion.name}-${index + 1}`}
                    suggestion={suggestion}
                    index={index + 1}
                  />
                ))}
              </div>
            </div>
          )}

          

          

          
        </>
      )}
    </article>
  );
}

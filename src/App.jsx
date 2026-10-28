import { useEffect, useMemo, useRef, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import ResultPanel from "./components/ResultPanel.jsx";
import EvaluationPanel from "./components/EvaluationPanel.jsx";
import LedgerPanel from "./components/LedgerPanel.jsx";
import IntegrationPanel from "./components/IntegrationPanel.jsx";
import LeafSpecimen from "./components/LeafSpecimen.jsx";
import StatStrip from "./components/StatStrip.jsx";
import { normalizeResult, checkHealth } from "./lib/kindwise.js";
import { computeMetrics, percent } from "./lib/metrics.js";
import { parseEvaluationCsv, downloadCsv } from "./lib/csv.js";
import { FIXTURE_ROWS } from "./lib/fixture.js";

const TABS = [
  { id: "identify", no: "01", label: "Identify" },
  { id: "evaluation", no: "02", label: "Evaluation" },
  { id: "ledger", no: "03", label: "Data ledger" },
  { id: "integration", no: "04", label: "Build notes" },
];

export default function App() {
  const [tab, setTab] = useState("identify");
  const [image, setImage] = useState(null); // { dataUrl, base64, name, width, height, bytes }
  const [rawResult, setRawResult] = useState(null);
  const [resultOrigin, setResultOrigin] = useState(""); // "live" | "sample" | "history"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [knownLabel, setKnownLabel] = useState("");
  const [records, setRecords] = useState([]);
  const [server, setServer] = useState({ state: "checking", hasApiKey: false, upstream: "", providers: [] });
  const [usage, setUsage] = useState(null);

  const csvInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then((health) => {
        if (cancelled) return;
        setServer({
          state: health.hasApiKey ? "ready" : "no-key",
          hasApiKey: health.hasApiKey,
          upstream: health.upstream,
          providers: health.providers || [],
        });
      })
      .catch(() => {
        if (!cancelled) setServer({ state: "offline", hasApiKey: false, upstream: "" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => (rawResult ? normalizeResult(rawResult) : null), [rawResult]);
  const rows = records.length ? records : FIXTURE_ROWS;
  const metrics = useMemo(() => computeMetrics(rows), [rows]);

  const handleResult = (payload, origin) => {
    setRawResult(payload);
    setResultOrigin(origin);
  };

  const recordCase = () => {
    if (!knownLabel.trim() || !result?.disease?.length) return;
    const top = result.disease[0];
    setRecords((previous) => [
      {
        id: `case-${Date.now()}`,
        actual: knownLabel.trim(),
        predicted: top.name,
        confidence: Number(top.probability) || null,
        crop: result.crop[0]?.name || "",
        image: image?.name || "—",
        source: resultOrigin === "sample" ? "Sample response" : result.providerName || "Plant.id",
        note: result.accessToken ? `access_token: ${result.accessToken}` : "",
      },
      ...previous,
    ]);
    setKnownLabel("");
    setNotice(
      resultOrigin === "sample"
        ? "Recorded the sample response. It appears in the ledger, but it is not real model output — exclude it before reporting."
        : "Labeled API result added to the evaluation ledger."
    );
  };

  const importCsv = async (file) => {
    if (!file) return;
    try {
      const imported = parseEvaluationCsv(await file.text());
      setRecords(imported);
      setError("");
      setNotice(`Imported ${imported.length} labeled row${imported.length === 1 ? "" : "s"} from ${file.name}. Metrics now use your file.`);
      setTab("evaluation");
    } catch (problem) {
      setError(problem.message || "That CSV could not be read.");
      setNotice("");
    }
  };

  const statusPill = () => {
    if (server.state === "checking") return { cls: "pill", text: "checking proxy" };
    if (server.state === "offline") return { cls: "pill pill-demo", text: "proxy offline" };
    if (server.state === "no-key") return { cls: "pill pill-demo", text: "no api key" };
    const configuredProviderCount = server.providers.filter((provider) => provider.hasApiKey).length;
    return {
      cls: "pill pill-live",
      text: configuredProviderCount ? "Plant.id ready" : "no api key",
    };
  };
  const pill = statusPill();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="25" height="25" viewBox="0 0 32 32" fill="none">
              <path d="M25.8 5.2C15.2 4.4 7.6 8.2 6.2 15.6 5.2 21.3 9.8 25.7 15.3 24.4 22.4 22.7 26 14.9 25.8 5.2Z" stroke="#E6F0E4" strokeWidth="1.7" />
              <path d="M6.7 26.2C10.5 20.5 15.4 15.4 22.8 9.2M13.5 18.9l-.2-5.2m4.1 1.1 4.7.3" stroke="#E6F0E4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <strong>LeafLab</strong>
            <small>crop disease identification and health monitoring</small>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="pill">Crop Health</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="reveal">
            <div className="sub">PLANT HEALTH / PLANT.ID</div>
            <h1>
              A closer look
              <br />
              at <em>leaf health.</em>
            </h1>
            <p className="hero-lead">
              Upload a crop leaf photo, read the model&apos;s condition candidates, then check those
              predictions against labels you recorded yourself. 
            </p>
            <div className="hero-meta">
              <span className="tag">Image → prediction → evidence</span>
              <span className="tag">Plant.id identification</span>
            </div>
          </div>
          <LeafSpecimen />
        </section>

        <StatStrip
          cells={[
            { label: "Evaluation cases", value: metrics.total, foot: records.length ? "your labeled data" : "illustrative fixture" },
            { label: "Top-1 accuracy", value: metrics.total ? percent(metrics.accuracy) : "—", foot: records.length ? "observed labels" : "fixture only · not measured" },
            { label: "Macro F1", value: metrics.total ? percent(metrics.macroF1) : "—", foot: "unweighted class average" },
          ]}
        />

        <nav className="tabs no-print" role="tablist" aria-label="Prototype sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              className="tab"
              onClick={() => setTab(item.id)}
            >
              <b>{item.no}</b>
              {item.label}
            </button>
          ))}
        </nav>

        {(error || notice) && (
          <div className={`note-box ${error ? "warn" : ""}`} role={error ? "alert" : "status"} style={{ marginBottom: "1rem" }}>
            {error || notice}
          </div>
        )}

        {tab === "identify" && (
          <div className="grid-2" id="panel-identify" role="tabpanel" aria-labelledby="tab-identify">
            <UploadPanel
              image={image}
              onImage={setImage}
              onResult={handleResult}
              onBusy={setBusy}
              onError={setError}
              onNotice={setNotice}
              busy={busy}
              serverState={server.state}
              providers={server.providers}
              usage={usage}
              onUsage={setUsage}
            />
            <ResultPanel
              result={result}
              origin={resultOrigin}
              image={image}
              busy={busy}
              knownLabel={knownLabel}
              onKnownLabel={setKnownLabel}
              onRecord={recordCase}
            />
          </div>
        )}

        {tab === "evaluation" && (
          <div id="panel-evaluation" role="tabpanel" aria-labelledby="tab-evaluation">
            <EvaluationPanel
              metrics={metrics}
              usingFixture={!records.length}
              recordCount={records.length}
              onImport={() => csvInputRef.current?.click()}
              onExport={() => downloadCsv(records)}
              canExport={records.length > 0}
            />
          </div>
        )}

        {tab === "ledger" && (
          <div id="panel-ledger" role="tabpanel" aria-labelledby="tab-ledger">
            <LedgerPanel
              records={records}
              onImport={() => csvInputRef.current?.click()}
              onExport={() => downloadCsv(records)}
              onClear={() => {
                setRecords([]);
                setNotice("In-session records cleared. The illustrative fixture is displayed again.");
              }}
            />
          </div>
        )}

        {tab === "integration" && (
          <div id="panel-integration" role="tabpanel" aria-labelledby="tab-integration">
            <IntegrationPanel server={server} />
          </div>
        )}
      </main>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          importCsv(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <footer>
        <span>LEAFLAB / CROP DISEASE IMAGE CLASSIFICATION</span>
        <span>React + Express + Nodejs </span>
      </footer>
    </div>
  );
}

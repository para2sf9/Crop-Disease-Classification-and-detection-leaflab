import { percent } from "../lib/metrics.js";

function ConfusionMatrix({ labels, matrix, maxCell }) {
  if (!labels.length) {
    return <div className="empty">No labels to compare yet.</div>;
  }
  return (
    <>
      <div className="matrix-wrap">
        <table className="matrix">
          <caption className="sr-only">Confusion matrix: rows are ground-truth labels, columns are predictions.</caption>
          <thead>
            <tr>
              <th scope="col" className="corner">Actual ↓<br />Predicted →</th>
              {labels.map((label) => (
                <th key={label} scope="col" className="colh" title={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((actual) => (
              <tr key={actual}>
                <th scope="row" className="rowh">{actual}</th>
                {labels.map((predicted) => {
                  const count = matrix[actual][predicted] || 0;
                  const strength = count ? 0.1 + 0.76 * (count / maxCell) : 0;
                  return (
                    <td
                      key={predicted}
                      title={`${actual} → ${predicted}: ${count}`}
                      style={{
                        background: count ? `rgba(30,107,74,${strength.toFixed(3)})` : "rgba(19,31,25,.035)",
                        color: strength > 0.45 ? "#fff" : "var(--ink)",
                      }}
                    >
                      {count || "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i style={{ background: "rgba(30,107,74,.82)" }} />more cases</span>
        <span><i style={{ background: "rgba(19,31,25,.06)" }} />none</span>
      </div>
    </>
  );
}

function Metric({ label, value, foot }) {
  return (
    <div className="strip-cell">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      <div className="n">{foot}</div>
    </div>
  );
}

export default function EvaluationPanel({ metrics, usingFixture, recordCount, onImport, onExport, canExport }) {
  const hasData = metrics.total > 0;

  return (
    <article className="card reveal">
      <div className="card-head">
        <div>
          <div className="sub">03 / PERFORMANCE REPORT</div>
          <h2 style={{ marginTop: ".25rem" }}>Measure against labels</h2>
          <p style={{ marginTop: ".35rem" }}>
            Every figure below is calculated in this browser from the ledger: the top-1 prediction is
            compared with the recorded ground-truth label. Macro figures weight each class equally.
          </p>
        </div>
        <div className="button-row">
          <button className="btn ghost tiny" type="button" onClick={onImport}>Import labeled CSV</button>
          <button className="btn ghost tiny" type="button" onClick={onExport} disabled={!canExport}>Export results</button>
        </div>
      </div>

      <div className={`note-box ${usingFixture ? "warn" : ""}`} style={{ marginBottom: "1rem" }}>
        {usingFixture ? (
          <>
            Showing <strong>{metrics.total} deterministic fixture rows</strong> so the report layout can be
            reviewed before data exists. The fixture is illustrative — it is <strong>not</strong> a Plant.id
            benchmark. Record verified API cases or import a CSV to replace it.
          </>
        ) : (
          <>
            Showing <strong>{recordCount} labeled case{recordCount === 1 ? "" : "s"}</strong> from your ledger.
            These summarise your own sample and should not be generalised to the service as a whole.
          </>
        )}
      </div>

      {hasData && (
        <div className="strip" style={{ marginBottom: "1.1rem" }}>
          <Metric label="Top-1 accuracy" value={percent(metrics.accuracy)} foot={`${metrics.correct} / ${metrics.total} correct`} />
          <Metric label="Macro precision" value={percent(metrics.macroPrecision)} foot="class-balanced" />
          <Metric label="Macro recall" value={percent(metrics.macroRecall)} foot="class-balanced" />
          <Metric label="Macro F1" value={percent(metrics.macroF1)} foot="harmonic mean" />
          <Metric label="Mean confidence" value={metrics.meanConfidence == null ? "—" : percent(metrics.meanConfidence)} foot="top-1 only" />
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="sub" style={{ marginBottom: ".55rem" }}>CONFUSION MATRIX · ROW = ACTUAL</div>
          <ConfusionMatrix labels={metrics.labels} matrix={metrics.matrix} maxCell={metrics.maxCell} />
        </div>
        <div>
          <div className="sub" style={{ marginBottom: ".55rem" }}>PER-CLASS SCORES</div>
          <div className="table-wrap">
            <table className="data">
              <caption className="sr-only">Precision, recall and F1 for each condition.</caption>
              <thead>
                <tr>
                  <th scope="col">Condition</th>
                  <th scope="col">Support</th>
                  <th scope="col">Precision</th>
                  <th scope="col">Recall</th>
                  <th scope="col">F1</th>
                </tr>
              </thead>
              <tbody>
                {metrics.perClass.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="n">{row.support}</td>
                    <td className="n">{percent(row.precision)}</td>
                    <td className="n">{percent(row.recall)}</td>
                    <td className="n">{percent(row.f1)}</td>
                  </tr>
                ))}
                {!metrics.perClass.length && (
                  <tr><td colSpan="5" className="empty">No rows yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="note-box" style={{ marginTop: ".8rem", fontSize: ".78rem" }}>
            <strong>Protocol note.</strong> Keep ground-truth labels independent of the model output, and do
            not evaluate on images used while tuning prompts, crops or thresholds. Sparse classes produce
            unstable scores; report support counts beside every percentage.
          </div>
        </div>
      </div>

      {hasData && metrics.errors.length > 0 && (
        <>
          <h3 className="sec">Misclassified cases</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Actual</th>
                  <th scope="col">Predicted</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Image</th>
                </tr>
              </thead>
              <tbody>
                {metrics.errors.slice(0, 12).map((row, index) => (
                  <tr key={row.id || index}>
                    <td className="n">{index + 1}</td>
                    <td>{row.actual}</td>
                    <td className="ng">{row.predicted}</td>
                    <td className="n">{row.confidence == null ? "—" : percent(row.confidence)}</td>
                    <td className="mono">{row.image || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metrics.errors.length > 12 && (
            <p className="note" style={{ marginTop: ".5rem" }}>
              Showing 12 of {metrics.errors.length} errors. Export the CSV for the full list.
            </p>
          )}
        </>
      )}
    </article>
  );
}

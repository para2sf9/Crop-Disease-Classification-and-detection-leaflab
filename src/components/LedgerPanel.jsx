import { percent, isCorrect } from "../lib/metrics.js";

export default function LedgerPanel({ records, onImport, onExport, onClear }) {
  return (
    <article className="card reveal">
      <div className="card-head">
        <div>
          <div className="sub">04 / LABELED OBSERVATIONS</div>
          <h2 style={{ marginTop: ".25rem" }}>Evaluation ledger</h2>
          <p style={{ marginTop: ".35rem" }}>
            One row per labeled image. Keep the label verified and independent of the prediction —
            the report is only as honest as this table.
          </p>
        </div>
        <div className="button-row">
          <button className="btn ghost tiny" type="button" onClick={onImport}>Import CSV</button>
          <button className="btn ghost tiny" type="button" onClick={onExport} disabled={!records.length}>Export CSV</button>
          <button className="btn danger tiny" type="button" onClick={onClear} disabled={!records.length}>Clear cases</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <caption className="sr-only">Labeled evaluation cases recorded in this session.</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Actual label</th>
              <th scope="col">Top-1 prediction</th>
              <th scope="col">Confidence</th>
              <th scope="col">Crop</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((row, index) => (
                <tr key={row.id}>
                  <td className="n">{index + 1}</td>
                  <td>{row.actual}</td>
                  <td className={isCorrect(row) ? "ok" : "ng"}>{row.predicted}</td>
                  <td className="n">{row.confidence == null ? "—" : percent(row.confidence)}</td>
                  <td className="mono">{row.crop || "—"}</td>
                  <td><span className="chip">{row.source}</span></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty">
                  No labeled cases yet. Identify an image, enter its verified condition, and choose
                  “Record label” — or import a CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="note-box" style={{ marginTop: "1rem" }}>
        <strong>CSV format.</strong> Required columns: <code>actual</code>, <code>predicted</code>.
        Optional: <code>confidence</code> (0–1 or <code>82%</code>), <code>crop</code>,
        <code>image</code>, <code>source</code>, <code>note</code>. An import replaces the current
        in-session ledger; export first if you need to keep it.
      </div>
    </article>
  );
}

import { useState } from "react";

const PROXY_SNIPPET = `// server/kindwise.js (simplified)
const providers = [
  { id: "crop-health", baseUrl: process.env.KINDWISE_BASE_URL, apiKey: process.env.KINDWISE_API_KEY },
  { id: "plant-id", baseUrl: process.env.PLANT_ID_BASE_URL, apiKey: process.env.PLANT_ID_API_KEY },
];

// Try Crop.health first. On an upstream/network failure, try Plant.id.
// Api-Key values are read only by Express and never sent to the browser.`;

const CLIENT_SNIPPET = `// src/lib/kindwise.js (excerpt)
export const identify = (payload) =>
  fetch("/api/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),                 // { images: [base64], similar_images: false }
  }).then((response) => response.json());`;

const CURL_SNIPPET = `# Call the local proxy; provider switching and credentials stay server-side
curl -X POST "http://localhost:8787/api/identify" \\
  -H "Content-Type: application/json" \\
  -d '{"images":["<base64>"],"similar_images":false}'`;

function CodeBlock({ title, code, onCopy }) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{title}</span>
        <button className="btn ghost tiny" type="button" onClick={() => onCopy(code)}>Copy</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export default function IntegrationPanel({ server, usage, onUsage }) {
  const [copied, setCopied] = useState("");

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied to clipboard.");
    } catch {
      setCopied("Clipboard blocked — select the text and copy manually.");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <article className="card reveal">
      <div className="card-head">
        <div>
          <div className="sub">05 / IMPLEMENTATION NOTES</div>
          <h2 style={{ marginTop: ".25rem" }}>How provider switching works</h2>
          <p style={{ marginTop: ".35rem" }}>
            React handles the interface and Express holds both API keys. Crop.health is tried first;
            Plant.id takes over after network, authorization, not-found, timeout, rate-limit, or server failures.
          </p>
        </div>
        <span className="chip">React · Express · automatic failover</span>
      </div>

      {copied && <div className="note-box" role="status" style={{ marginBottom: ".8rem" }}>{copied}</div>}

      <div className="grid-3">
        <div className="note-box">
          <strong>CO4 · draft mapping</strong><br />
          Structure an image-classification workflow, compare predictions with ground truth, and report
          class-aware metrics. Confirm the official wording with your instructor.
        </div>
        <div className="note-box">
          <strong>CO6 · draft mapping</strong><br />
          Integrate an external AI service into an interactive application, handle errors and credits, and
          communicate uncertainty and limitations. Confirm the official wording with your instructor.
        </div>
        <div className="note-box warn">
          <strong>Scope boundary</strong><br />
          Both providers perform hosted inference. Accuracy figures shown in the fixture are placeholders; the
          vendor publishes its own validation numbers, which you should cite from their site.
        </div>
      </div>

      <div className="kv-table" style={{ marginTop: "1rem" }}>
        <dl className="kv">
          <div><dt>Primary</dt><dd><code>https://crop.kindwise.com/api/v1/identification</code> · Crop.health</dd></div>
          <div><dt>Fallback</dt><dd><code>https://plant.id/api/v3/identification</code> · Plant.id</dd></div>
          <div><dt>Auth</dt><dd><code>Api-Key</code> header, server-side only</dd></div>
          <div><dt>Proxy</dt><dd><code>POST /api/identify</code> with failover between providers; lifecycle routes use Crop.health</dd></div>
          <div><dt>Details</dt><dd><code>description, treatment, symptoms, severity, spreading, common_names, taxonomy, eppo_code, wiki_url, image</code></dd></div>
          <div><dt>Proxy status</dt><dd>{server.state}{server.providers?.length ? ` · ${server.providers.filter((provider) => provider.hasApiKey).map((provider) => provider.name).join(" + ") || "no provider key"}` : ""}</dd></div>
        </dl>
      </div>

      <h3 className="sec">Server proxy</h3>
      <CodeBlock title="server/kindwise.js" code={PROXY_SNIPPET} onCopy={copy} />

      <h3 className="sec">Browser client</h3>
      <CodeBlock title="src/lib/kindwise.js" code={CLIENT_SNIPPET} onCopy={copy} />

      <h3 className="sec">Use the local proxy</h3>
      <CodeBlock title="terminal" code={CURL_SNIPPET} onCopy={copy} />

      <h3 className="sec">Credits</h3>
      <div className="button-row">
        <button
          className="btn ghost tiny"
          type="button"
          onClick={async () => {
            try {
              const data = await (await fetch("/api/usage")).json();
              onUsage(data);
            } catch {
              onUsage({ error: "Usage unavailable. Check the proxy and key." });
            }
          }}
        >
          Fetch GET /usage_info
        </button>
      </div>
      {usage && <pre className="raw-json" style={{ marginTop: ".6rem" }}><code>{JSON.stringify(usage, null, 2)}</code></pre>}

      <h3 className="sec">Production checklist</h3>
      <ul className="clean">
        <li>Set <code>KINDWISE_API_KEY</code> and <code>PLANT_ID_API_KEY</code> in <code>.env</code>; never expose either key to the client bundle.</li>
        <li>Add authentication, per-user rate limits, and a maximum upload size before exposing the proxy publicly.</li>
        <li>Record <code>access_token</code> with each evaluation case so a prediction can be re-fetched or reported later.</li>
        <li>Note the crop, cultivar, growth stage, lighting and device for every labelled image.</li>
        <li>Treat confidence as a ranking score, not a calibrated probability, unless you run a calibration study.</li>
        <li>Never present the illustrative fixture as measured model performance.</li>
      </ul>

      <h3 className="sec">References</h3>
      <p style={{ fontSize: ".84rem" }}>
        <a href="https://www.kindwise.com/" target="_blank" rel="noreferrer">Kindwise</a> ·{" "}
        <a href="https://crop.kindwise.com/docs" target="_blank" rel="noreferrer">Crop.health API docs</a> ·{" "}
        <a href="https://plant.id/" target="_blank" rel="noreferrer">Plant.id</a> ·{" "}
        <a href="https://github.com/flowerchecker/crop-health-examples" target="_blank" rel="noreferrer">Official examples</a>
      </p>
    </article>
  );
}

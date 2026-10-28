# LeafLab — crop leaf condition identification

A React + Express prototype that identifies crop leaf conditions with
[Plant.id](https://plant.id/) and reports class-aware evaluation metrics
computed from labeled images.

Built for a course deliverable mapped to **CO4** (perform and evaluate image
classification) and **CO6** (integrate an AI capability into an application).
Confirm the official outcome wording with your instructor before you submit.

---

## What it does

1. **Identify** — pick a leaf photo, downscale it in the browser, send it through a
   local proxy to `POST /api/v1/identification`, and read crop + disease candidates
   with probabilities and condition details. Only candidates at or above 70%
   confidence are shown.
2. **Evaluate** — record a verified label for each image (or import a CSV) and get
   top-1 accuracy, macro precision / recall / F1, a confusion matrix, per-class
   scores, and the list of misclassifications.
3. **Ledger** — inspect and export the labeled rows; export doubles as your report
   appendix.
4. **Build notes** — endpoint contract, proxy shape, credits, and limitations.

The Plant.id API key lives in the server process only. The browser talks to
your own server; it never sees the key.

---

## Quick start

```bash
# 1. install
npm install

# 2. configure the Plant.id key in .env
cp .env.example .env
#    set PLANT_ID_API_KEY

# 3. run the proxy and the Vite dev server together
npm run dev
#    → app:   http://localhost:5173
#    → proxy: http://localhost:8787
```

Express sends identification, lifecycle, and usage requests only to Plant.id.
The key is read by Express and never enters the browser bundle.

### Production build

```bash
npm run build     # emits dist/
npm start         # Express serves dist/ and /api on PORT (default 8787)
```

---

## Project layout

```
leaflab/
├── index.html                   Vite entry
├── vite.config.js               dev proxy: /api → localhost:8787
├── .env.example
├── server/
│   ├── index.js                 Express routes, CORS, body limits
│   └── kindwise.js              Plant.id client, validation, error mapping
├── src/
│   ├── main.jsx
│   ├── App.jsx                  tabs, session state, ledger
│   ├── styles.css               design tokens + components
│   ├── components/
│   │   ├── UploadPanel.jsx      file input, drag & drop, image prep, identify call
│   │   ├── ResultPanel.jsx      candidates, confidence bars, condition details
│   │   ├── EvaluationPanel.jsx  metrics, confusion matrix, per-class table
│   │   ├── LedgerPanel.jsx      labeled rows, import/export
│   │   ├── IntegrationPanel.jsx endpoint contract and code snippets
│   │   ├── StatStrip.jsx
│   │   └── LeafSpecimen.jsx     hero SVG
│   └── lib/
│       ├── kindwise.js          proxy fetch wrappers + response normaliser
│       ├── metrics.js           accuracy / macro P-R-F1 / confusion matrix
│       ├── csv.js               CSV parse + export
│       ├── image.js             canvas downscale → JPEG base64
│       └── fixture.js           clearly-labeled placeholder rows
├── scripts/evaluate.mjs         CLI: same metrics, printed report
└── data/evaluation-sample.csv   example labeled set
```

---

## API contract used

| Item | Value |
| --- | --- |
| Endpoint | `POST https://plant.id/api/v3/identification` |
| Auth | `PLANT_ID_API_KEY` in the server-side `Api-Key` header |
| Body (JSON) | `{ "images": ["<base64>"], "health": "all" }` |
| Optional fields | `latitude`, `longitude`, `datetime`, `custom_id`, `language` |
| Query params | `details`, `language` |
| Key response path | Crop: `result.classification.suggestions[]`; health: `result.health_assessment.diseases[]` |
| Suggestion fields | `id`, `name`, `scientific_name`, `probability`, `similar_images`, `details` |
| Lifecycle | `GET /identification/{token}`, `DELETE /identification/{token}`, `POST /identification/{token}/feedback`, `GET /usage_info` |

Other endpoints proxied locally:

| Local route | Upstream |
| --- | --- |
| `POST /api/identify` | `POST /identification` |
| `GET /api/identification/:token` | `GET /identification/{token}` |
| `DELETE /api/identification/:token` | `DELETE /identification/{token}` |
| `POST /api/identification/:token/feedback` | `POST /identification/{token}/feedback` |
| `GET /api/usage` | `GET /usage_info` |
| `GET /api/health` | local only — Plant.id key-presence check |
| `POST /api/validate` | local only — payload dry run, spends no credits |

---

## Evaluation protocol

The report is only meaningful if the labels are honest.

1. **Fix the label set first.** Decide which crop and which conditions you are
   testing, and record that scope in your report. The service covers a fixed set
   of 23 crops and roughly 300 health issues, so a label outside that set cannot
   be predicted.
2. **Separate collection from inspection.** Capture or collect images, label them,
   and only then run identification. Do not adjust labels after seeing the output.
3. **Record provenance.** For each image store: crop, cultivar if known, growth
   stage, lighting, device, and the `access_token` of the response.
4. **Report support beside every score.** A class with three examples produces a
   wildly unstable recall figure.
5. **Say what the numbers describe.** These are metrics for *your sample*. They
   are not the vendor's benchmark; cite the vendor separately if you quote theirs.
6. **Include failures.** Show misclassified cases and low-confidence predictions,
   and discuss likely causes (blur, occlusion, mixed symptoms, out-of-scope crop).

### Metrics implemented

- Top-1 accuracy: `correct / total`
- Per class: precision, recall, F1 from the confusion matrix
- Macro precision / recall / F1: unweighted mean over classes
- Mean top-1 confidence
- Confusion matrix and misclassification list

Confidence is a ranking score from the API, **not** a calibrated probability.
If you need calibrated values, that requires a calibration study with held-out
data — out of scope for this prototype, and any claim otherwise would be wrong.

---

## Things this prototype deliberately does not do

- It does not train, fine-tune, or host a model. The configured providers perform inference.
- It does not present the fixture rows as measured performance. The fixture is
  labeled `Illustrative fixture` in the CSV and flagged in the UI.
- It does not persist anything. Records live in React state; export before closing.
- It does not give treatment advice as a conclusion. Treatment text comes from the
  API details, is displayed as reference, and should be checked with a local
  agronomist before acting on it.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `no api key` pill | Plant.id key is empty | Add `PLANT_ID_API_KEY` to `.env`, restart |
| `proxy offline` pill | server not running | `npm run dev:server` |
| 401 from proxy | Plant.id rejected the key | Verify the key in your Plant.id account |
| 429 from proxy | Plant.id credits exhausted | Check Plant.id account usage and plan |
| 413 | image too large | The browser already downscales; check `express.json` limit |
| CORS error | origin not allowed | Add it to `ALLOWED_ORIGINS` |
| Blank page after `npm start` | no `dist/` | Run `npm run build` first |

---

## Offline metric check

```bash
node scripts/evaluate.mjs data/evaluation-sample.csv
```

Prints the same accuracy, macro scores, per-class table, and confusion matrix the
browser computes, so you can confirm the numbers are reproducible and paste them
into a report appendix.

---

## References

- [Plant.id](https://plant.id/)
- [Plant.id API documentation](https://plant.id/)

The health endpoint reports whether a Plant.id key is configured, but never
returns its value. Identification requests enable health assessment so disease
suggestions are included.

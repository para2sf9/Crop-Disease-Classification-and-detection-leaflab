/** Small RFC-4180-ish CSV reader/writer for the evaluation ledger. */

function parseRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES = {
  actual: ["actual", "ground_truth", "true_label", "expected", "label", "y_true"],
  predicted: ["predicted", "prediction", "model_prediction", "predicted_label", "y_pred"],
  confidence: ["confidence", "score", "probability", "top1_confidence"],
  crop: ["crop", "species", "host"],
  note: ["note", "notes", "comment"],
  image: ["image", "file", "filename"],
};

function columnIndex(headers, key) {
  return headers.findIndex((header) => HEADER_ALIASES[key].includes(header));
}

export function parseEvaluationCsv(text) {
  const rows = parseRows(String(text ?? ""));
  if (rows.length < 2) {
    throw new Error("The CSV needs a header row and at least one data row.");
  }

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[ -]+/g, "_"));
  const actualIndex = columnIndex(headers, "actual");
  const predictedIndex = columnIndex(headers, "predicted");
  if (actualIndex < 0 || predictedIndex < 0) {
    throw new Error("Include columns named actual and predicted (or ground_truth and prediction).");
  }

  const confidenceIndex = columnIndex(headers, "confidence");
  const cropIndex = columnIndex(headers, "crop");
  const noteIndex = columnIndex(headers, "note");
  const imageIndex = columnIndex(headers, "image");

  const records = rows
    .slice(1)
    .map((row, index) => {
      const raw = confidenceIndex >= 0 ? String(row[confidenceIndex] ?? "").trim() : "";
      let confidence = null;
      if (raw) {
        const numeric = Number(raw.replace("%", ""));
        if (Number.isFinite(numeric)) {
          confidence = Math.max(0, Math.min(1, raw.includes("%") || numeric > 1 ? numeric / 100 : numeric));
        }
      }
      return {
        id: `csv-${index}-${Date.now()}`,
        actual: String(row[actualIndex] ?? "").trim(),
        predicted: String(row[predictedIndex] ?? "").trim(),
        confidence,
        crop: cropIndex >= 0 ? String(row[cropIndex] ?? "").trim() : "",
        note: noteIndex >= 0 ? String(row[noteIndex] ?? "").trim() : "",
        image: imageIndex >= 0 ? String(row[imageIndex] ?? "").trim() : "",
        source: "CSV import",
      };
    })
    .filter((record) => record.actual && record.predicted);

  if (!records.length) {
    throw new Error("No usable rows were found. Every row needs both an actual and a predicted label.");
  }
  return records;
}

function quote(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function toEvaluationCsv(rows) {
  const header = ["actual", "predicted", "confidence", "crop", "image", "source", "note"];
  const body = rows.map((row) =>
    [
      row.actual,
      row.predicted,
      row.confidence == null ? "" : (Number(row.confidence) * 100).toFixed(1) + "%",
      row.crop,
      row.image,
      row.source,
      row.note,
    ]
      .map(quote)
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}

export function downloadCsv(rows, filename = "leaflab-evaluation.csv") {
  const blob = new Blob([toEvaluationCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

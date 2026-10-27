/**
 * Evaluation metrics computed in the browser.
 *
 * Everything here is plain arithmetic over labelled predictions; no model is
 * trained and no metric is invented. If there are zero rows, the caller gets
 * `total: 0` and must render "not measured" rather than a number.
 */

export const percent = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
};

export const normalizeLabel = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const isCorrect = (row) => normalizeLabel(row.actual) === normalizeLabel(row.predicted);

export function topPrediction(suggestionList, cutoff = 0.9) {
  const list = Array.isArray(suggestionList) ? suggestionList : [];
  const best = list.reduce(
    (acc, item) => (Number(item?.probability) > Number(acc?.probability ?? -1) ? item : acc),
    null
  );
  const top = list.filter((item) => Number(item?.probability) >= cutoff);
  return { best, top };
}

/**
 * @param {Array<{actual: string, predicted: string, confidence?: number|null}>} rows
 */
export function computeMetrics(rows) {
  const usable = (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row?.actual ?? "").trim() && String(row?.predicted ?? "").trim()
  );

  const labels = [...new Set(usable.flatMap((row) => [row.actual.trim(), row.predicted.trim()]))].sort(
    (a, b) => a.localeCompare(b)
  );

  const matrix = Object.fromEntries(
    labels.map((actual) => [
      actual,
      Object.fromEntries(labels.map((predicted) => [predicted, 0])),
    ])
  );
  for (const row of usable) {
    const cell = matrix[row.actual.trim()]?.[row.predicted.trim()];
    if (cell !== undefined) matrix[row.actual.trim()][row.predicted.trim()] = cell + 1;
  }

  const total = usable.length;
  const correct = usable.filter(isCorrect).length;

  const perClass = labels.map((label) => {
    const truePositive = matrix[label]?.[label] ?? 0;
    const support = usable.filter((row) => normalizeLabel(row.actual) === normalizeLabel(label)).length;
    const predictedCount = usable.filter(
      (row) => normalizeLabel(row.predicted) === normalizeLabel(label)
    ).length;
    const recall = support ? truePositive / support : 0;
    const precision = predictedCount ? truePositive / predictedCount : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, truePositive, support, predictedCount, precision, recall, f1 };
  });

  const mean = (key) =>
    perClass.length ? perClass.reduce((sum, item) => sum + item[key], 0) / perClass.length : 0;

  const confidences = usable
    .map((row) => Number(row.confidence))
    .filter((value) => Number.isFinite(value));

  const maxCell = Math.max(
    1,
    ...labels.flatMap((actual) => labels.map((predicted) => matrix[actual][predicted]))
  );

  return {
    labels,
    matrix,
    maxCell,
    total,
    correct,
    accuracy: total ? correct / total : 0,
    macroPrecision: mean("precision"),
    macroRecall: mean("recall"),
    macroF1: mean("f1"),
    meanConfidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null,
    perClass,
    errors: usable.filter((row) => !isCorrect(row)),
  };
}

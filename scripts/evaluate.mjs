#!/usr/bin/env node
/**
 * Offline evaluation runner.
 *
 *   node scripts/evaluate.mjs data/evaluation-sample.csv
 *
 * Reads a labeled CSV (actual,predicted,confidence), recomputes the same
 * metrics the browser shows, and prints a plain-text report. Useful for a lab
 * report appendix and for checking that the UI numbers are reproducible.
 */

import fs from "node:fs";
import path from "node:path";

const ALIASES = {
  actual: ["actual", "ground_truth", "true_label", "expected", "label", "y_true"],
  predicted: ["predicted", "prediction", "model_prediction", "predicted_label", "y_pred"],
  confidence: ["confidence", "score", "probability"],
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const norm = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const pct = (value) => `${(value * 100).toFixed(1)}%`;

function loadRows(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[ -]+/g, "_"));
  const index = (key) => headers.findIndex((header) => ALIASES[key].includes(header));
  const actualIndex = index("actual");
  const predictedIndex = index("predicted");
  const confidenceIndex = index("confidence");
  if (actualIndex < 0 || predictedIndex < 0) {
    throw new Error("Include actual and predicted columns (or ground_truth and prediction).");
  }
  return rows.slice(1).map((row) => {
    const raw = confidenceIndex >= 0 ? String(row[confidenceIndex] ?? "").trim() : "";
    let confidence = null;
    if (raw) {
      const numeric = Number(raw.replace("%", ""));
      if (Number.isFinite(numeric)) {
        confidence = Math.max(0, Math.min(1, raw.includes("%") || numeric > 1 ? numeric / 100 : numeric));
      }
    }
    return {
      actual: String(row[actualIndex] ?? "").trim(),
      predicted: String(row[predictedIndex] ?? "").trim(),
      confidence,
    };
  }).filter((row) => row.actual && row.predicted);
}

function computeMetrics(rows) {
  const labels = [...new Set(rows.flatMap((row) => [row.actual, row.predicted]))].sort((a, b) => a.localeCompare(b));
  const matrix = Object.fromEntries(labels.map((a) => [a, Object.fromEntries(labels.map((p) => [p, 0]))]));
  for (const row of rows) matrix[row.actual][row.predicted] += 1;

  const correct = rows.filter((row) => norm(row.actual) === norm(row.predicted)).length;
  const perClass = labels.map((label) => {
    const tp = matrix[label][label];
    const support = rows.filter((row) => norm(row.actual) === norm(label)).length;
    const predicted = rows.filter((row) => norm(row.predicted) === norm(label)).length;
    const recall = support ? tp / support : 0;
    const precision = predicted ? tp / predicted : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, support, tp, precision, recall, f1 };
  });
  const mean = (key) => (perClass.length ? perClass.reduce((sum, row) => sum + row[key], 0) / perClass.length : 0);
  const confidences = rows.map((row) => row.confidence).filter((value) => value != null);

  return {
    labels, matrix, total: rows.length, correct,
    accuracy: rows.length ? correct / rows.length : 0,
    macroPrecision: mean("precision"), macroRecall: mean("recall"), macroF1: mean("f1"),
    meanConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
    perClass,
  };
}

const file = process.argv[2] || path.join("data", "evaluation-sample.csv");
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const rows = loadRows(file);
const metrics = computeMetrics(rows);

console.log("LeafLab evaluation report");
console.log("=".repeat(52));
console.log(`Source file      ${file}`);
console.log(`Labeled cases    ${metrics.total}`);
console.log(`Correct (top-1)  ${metrics.correct}`);
console.log(`Top-1 accuracy   ${pct(metrics.accuracy)}`);
console.log(`Macro precision  ${pct(metrics.macroPrecision)}`);
console.log(`Macro recall     ${pct(metrics.macroRecall)}`);
console.log(`Macro F1         ${pct(metrics.macroF1)}`);
console.log(`Mean confidence  ${metrics.meanConfidence == null ? "n/a" : pct(metrics.meanConfidence)}`);
console.log("");
console.log("Per class");
console.log("-".repeat(52));
console.log(["condition".padEnd(18), "support".padStart(8), "precision".padStart(10), "recall".padStart(8), "f1".padStart(7)].join(""));
for (const row of metrics.perClass) {
  console.log([row.label.padEnd(18), String(row.support).padStart(8), pct(row.precision).padStart(10), pct(row.recall).padStart(8), pct(row.f1).padStart(7)].join(""));
}
console.log("");
console.log("Confusion matrix (rows = actual, columns = predicted)");
console.log("-".repeat(52));
const width = 22;
console.log(["actual \\ predicted".padEnd(width), ...metrics.labels.map((label) => label.slice(0, 14).padStart(16))].join(""));
for (const actual of metrics.labels) {
  console.log([actual.padEnd(width), ...metrics.labels.map((predicted) => String(metrics.matrix[actual][predicted]).padStart(16))].join(""));
}
console.log("");
console.log("Note: these figures describe the rows in this file only. Do not present them as the");
console.log("service's overall accuracy. Sparse classes give unstable estimates — report support.");

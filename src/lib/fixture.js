/**
 * Deterministic fixture rows for the evaluation UI.
 *
 * These are hand-written placeholders so charts, tables and the confusion
 * matrix can be inspected before real labelled data exists. They are NOT
 * Plant.id benchmark results and must never be reported as model performance.
 */

const PATTERN = {
  Healthy: ["Healthy", "Healthy", "Healthy", "Healthy", "Healthy", "Healthy", "Healthy", "Leaf spot"],
  "Early blight": ["Early blight", "Early blight", "Early blight", "Early blight", "Early blight", "Early blight", "Late blight", "Leaf spot"],
  "Late blight": ["Late blight", "Late blight", "Late blight", "Late blight", "Late blight", "Late blight", "Late blight", "Early blight"],
  "Leaf spot": ["Leaf spot", "Leaf spot", "Leaf spot", "Leaf spot", "Leaf spot", "Leaf spot", "Healthy", "Early blight"],
};

export const FIXTURE_ROWS = Object.entries(PATTERN).flatMap(([actual, predictedList], groupIndex) =>
  predictedList.map((predicted, index) => ({
    id: `fixture-${groupIndex}-${index}`,
    actual,
    predicted,
    confidence:
      predicted === actual ? 0.84 + (index % 4) * 0.025 : 0.54 + (index % 3) * 0.045,
    crop: "Solanum lycopersicum",
    image: `fixture-${groupIndex}-${index}.jpg`,
    source: "Illustrative fixture",
    note: "Placeholder row — not a measured prediction.",
  }))
);

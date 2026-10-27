export default function StatStrip({ cells }) {
  return (
    <section className="strip reveal" aria-label="Evaluation summary">
      {cells.map((cell) => (
        <div className="strip-cell" key={cell.label}>
          <div className="k">{cell.label}</div>
          <div className="v">{cell.value}</div>
          <div className="n">{cell.foot}</div>
        </div>
      ))}
    </section>
  );
}

export default function IntegrationPanel({ server }) {
  return (
    <article className="card reveal">
      <div className="card-head">
        <div>
          <div className="sub">05 / IMPLEMENTATION NOTES</div>
          <h2 style={{ marginTop: ".25rem" }}>Plant.id integration</h2>
          <p style={{ marginTop: ".35rem" }}>
            React sends identification requests to the local Express proxy. The proxy uses the
            server-side Plant.id API key for identification and related account requests.
          </p>
        </div>
        <span className="chip">React · Express · Plant.id</span>
      </div>

      <div className="note-box">
        <strong>Upstream:</strong> <code>{server.upstream || "https://plant.id/api/v3"}</code>
        <br />
        <strong>Credential:</strong> <code>PLANT_ID_API_KEY</code> (server-side only)
      </div>
    </article>
  );
}

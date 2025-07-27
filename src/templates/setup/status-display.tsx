export function StatusDisplay() {
  return (
    <section id="status-display" className="config-summary" style="display: none;">
      <h2>Current Configuration</h2>
      <div id="config-items"></div>
      <div className="actions">
        <a href="/playground" className="button">Go to Playground</a>
      </div>
    </section>
  );
}
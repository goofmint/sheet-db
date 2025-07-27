export function SetupHeader() {
  return (
    <header>
      <h1>SheetDB Setup</h1>
      <div id="setup-status" className="setup-status not-configured">
        <span className="status-icon">⚠️</span>
        <span className="status-text">Checking setup status...</span>
      </div>
    </header>
  );
}
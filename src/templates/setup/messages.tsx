export function Messages() {
  return (
    <>
      <div className="welcome-message">
        <p>Welcome to SheetDB setup</p>
        <p>Configure your Google OAuth and Auth0 credentials to get started.</p>
      </div>
      <div id="success-message" className="success-message"></div>
      <div id="error-message" className="error-message"></div>
    </>
  );
}
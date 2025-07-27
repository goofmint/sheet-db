export function AuthSection() {
  return (
    <section id="auth-section" className="auth-section" style="display: none;">
      <h2>Authentication Required</h2>
      <form id="auth-form">
        <div className="field-group">
          <label htmlFor="config-password-auth">Configuration Password</label>
          <input 
            type="password" 
            id="config-password-auth" 
            placeholder="Enter your configuration password"
            required
          />
          <div id="config-password-auth-error" className="field-error"></div>
        </div>
        <button type="button" id="auth-button" className="primary-button">Authenticate</button>
      </form>
    </section>
  );
}
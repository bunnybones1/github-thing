type AuthPanelProps = {
  status: 'checking' | 'authenticated' | 'unauthenticated'
  loading: boolean
  canLoad: boolean
  onLogin: () => void
  onLogout: () => void
  onLoadAccess: () => void
}

const AuthPanel = ({
  status,
  loading,
  canLoad,
  onLogin,
  onLogout,
  onLoadAccess,
}: AuthPanelProps) => (
  <section className="auth-panel">
    <div className="auth-copy">
      <p className="auth-title">GitHub connection</p>
      <p className="auth-subtitle">
        Sign in with GitHub to load the organizations and repositories you can access.
      </p>
    </div>
    <div className="auth-actions">
      {status === 'checking' ? (
        <p className="auth-status">Checking session...</p>
      ) : status === 'authenticated' ? (
        <>
          <button className="button ghost" type="button" onClick={onLogout}>
            Sign out
          </button>
          <button
            className="button primary"
            type="button"
            onClick={onLoadAccess}
            disabled={!canLoad}
          >
            {loading ? 'Loading...' : 'Load access'}
          </button>
        </>
      ) : (
        <button className="button primary" type="button" onClick={onLogin}>
          Sign in with GitHub
        </button>
      )}
    </div>
    <p className="hint">
      OAuth sessions are stored in a secure cookie. Refresh the data when you want the
      latest results.
    </p>
  </section>
)

export default AuthPanel

import type { GitHubUser } from '../types'

type AuthPanelProps = {
  status: 'checking' | 'authenticated' | 'unauthenticated'
  loading: boolean
  canLoad: boolean
  profile: GitHubUser | null
  orgCount: number
  repoCount: number
  lastUpdatedLabel: string | null
  onLogin: () => void
  onLogout: () => void
  onLoadAccess: () => void
  onRefresh: () => void
}

const AuthPanel = ({
  status,
  loading,
  canLoad,
  profile,
  orgCount,
  repoCount,
  lastUpdatedLabel,
  onLogin,
  onLogout,
  onLoadAccess,
  onRefresh,
}: AuthPanelProps) => (
  <section className="auth-panel">
    <div className="connection-header">
      <div className="auth-copy">
        <p className="auth-title">GitHub connection</p>
        <p className="auth-subtitle">
          {status === 'authenticated' ? (
            profile ? (
              <>
                Signed in as <strong>{profile.login}</strong>
              </>
            ) : (
              'Signed in. Load access to fetch your orgs and repos.'
            )
          ) : status === 'checking' ? (
            'Checking session...'
          ) : (
            'Sign in to load the organizations and repositories you can access.'
          )}
        </p>
        {status === 'authenticated' && profile?.name ? (
          <p className="auth-meta">{profile.name}</p>
        ) : null}
      </div>
      <span
        className={`status-pill ${
          status === 'authenticated' ? 'ready' : status === 'checking' ? 'checking' : ''
        }`}
      >
        {status === 'authenticated'
          ? 'Connected'
          : status === 'checking'
            ? 'Checking'
            : 'Not connected'}
      </span>
    </div>

    {status === 'authenticated' && profile ? (
      <>
        <div className="summary-metrics">
          <div>
            <p className="metric-label">Organizations</p>
            <p className="metric-value">{orgCount}</p>
          </div>
          <div>
            <p className="metric-label">Repositories</p>
            <p className="metric-value">{repoCount}</p>
          </div>
        </div>
        {lastUpdatedLabel ? (
          <p className="summary-updated">Last updated {lastUpdatedLabel}</p>
        ) : null}
      </>
    ) : null}

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
            onClick={profile ? onRefresh : onLoadAccess}
            disabled={!canLoad}
          >
            {loading
              ? profile
                ? 'Refreshing...'
                : 'Loading...'
              : profile
                ? 'Refresh data'
                : 'Load access'}
          </button>
        </>
      ) : (
        <button className="button primary" type="button" onClick={onLogin}>
          Sign in with GitHub
        </button>
      )}
    </div>

    {status !== 'authenticated' ? (
      <p className="hint">
        OAuth sessions are stored in a secure cookie. Refresh the data when you want the
        latest results.
      </p>
    ) : null}
  </section>
)

export default AuthPanel

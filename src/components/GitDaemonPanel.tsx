import type { GitDaemonMeta, GitDaemonPairStartResponse } from '../lib/gitDaemon'

type GitDaemonPanelProps = {
  baseUrl: string
  status: 'idle' | 'checking' | 'ready' | 'error'
  error: string
  meta: GitDaemonMeta | null
  pairing: GitDaemonPairStartResponse | null
  pairCode: string
  hasToken: boolean
  onBaseUrlChange: (value: string) => void
  onConnect: () => void
  onPairStart: () => void
  onPairConfirm: () => void
  onForgetToken: () => void
  onPairCodeChange: (value: string) => void
}

const GitDaemonPanel = ({
  baseUrl,
  status,
  error,
  meta,
  pairing,
  pairCode,
  hasToken,
  onBaseUrlChange,
  onConnect,
  onPairStart,
  onPairConfirm,
  onForgetToken,
  onPairCodeChange,
}: GitDaemonPanelProps) => {
  const connectLabel =
    status === 'checking' ? 'Checking...' : status === 'ready' ? 'Reconnect' : 'Connect'
  const requiresPairing = status === 'ready' && meta?.pairing.required && !hasToken
  const statusLabel = requiresPairing
    ? 'Pairing required'
    : status === 'ready'
      ? 'Connected'
      : status === 'checking'
        ? 'Checking'
        : status === 'error'
          ? 'Error'
          : 'Not connected'
  const statusTone = requiresPairing ? 'checking' : status

  return (
    <section className="auth-panel daemon-panel">
      <div className="auth-copy">
        <p className="auth-title">Git daemon (optional)</p>
        <p className="auth-subtitle">
          Pair with your local git-daemon to enable one-click clone for repos.
        </p>
      </div>
      <div className="daemon-grid">
        <label className="field">
          <span className="field-label">Base URL</span>
          <input
            className="text-input"
            type="text"
            inputMode="url"
            value={baseUrl}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            placeholder="https://127.0.0.1:8791"
          />
        </label>
        <div className="daemon-actions">
          <button
            className="button primary"
            type="button"
            onClick={onConnect}
            disabled={status === 'checking'}
          >
            {connectLabel}
          </button>
          {hasToken ? (
            <button className="button ghost" type="button" onClick={onForgetToken}>
              Forget pairing
            </button>
          ) : null}
        </div>
      </div>
      <div className="daemon-status">
        <span className={`status-pill ${statusTone}`}>{statusLabel}</span>
        <span className="daemon-meta">
          {meta
            ? `Daemon v${meta.version} · Workspace ${
                meta.workspace.configured ? 'configured' : 'missing'
              }`
            : 'Add this app origin to your git-daemon allowlist.'}
        </span>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      {status === 'ready' && meta?.pairing.required && !hasToken ? (
        <div className="daemon-pair">
          <div>
            <p className="pair-title">Pairing required</p>
            <p className="pair-subtitle">
              Start pairing to receive a code from git-daemon.
            </p>
          </div>
          {pairing ? (
            <div className="pair-steps">
              <p className="pair-instructions">{pairing.instructions}</p>
              {pairing.code ? (
                <p className="pair-code">
                  Code: <code>{pairing.code}</code>
                </p>
              ) : null}
              <label className="field">
                <span className="field-label">Pair code</span>
                <input
                  className="text-input"
                  type="text"
                  value={pairCode}
                  onChange={(event) => onPairCodeChange(event.target.value)}
                />
              </label>
              <div className="pair-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={onPairConfirm}
                  disabled={!pairCode}
                >
                  Confirm pairing
                </button>
              </div>
            </div>
          ) : (
            <button className="button ghost" type="button" onClick={onPairStart}>
              Start pairing
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default GitDaemonPanel

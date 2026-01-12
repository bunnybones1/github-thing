import { useState } from 'react'
import type { GitDaemonMeta, GitDaemonPairStartResponse } from '../lib/gitDaemon'
import AuthPanel from './AuthPanel'
import GitDaemonPanel from './GitDaemonPanel'
import ModalShell from './ModalShell'

type ConnectionsHubProps = {
  authStatus: 'checking' | 'authenticated' | 'unauthenticated'
  loading: boolean
  canRefresh: boolean
  onLogin: () => void
  onLogout: () => void
  onLoadAccess: () => void
  daemonBaseUrl: string
  daemonStatus: 'idle' | 'checking' | 'ready' | 'error'
  daemonError: string
  daemonMeta: GitDaemonMeta | null
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

const ConnectionsHub = ({
  authStatus,
  loading,
  canRefresh,
  onLogin,
  onLogout,
  onLoadAccess,
  daemonBaseUrl,
  daemonStatus,
  daemonError,
  daemonMeta,
  pairing,
  pairCode,
  hasToken,
  onBaseUrlChange,
  onConnect,
  onPairStart,
  onPairConfirm,
  onForgetToken,
  onPairCodeChange,
}: ConnectionsHubProps) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isDaemonModalOpen, setIsDaemonModalOpen] = useState(false)

  const authStatusLabel =
    authStatus === 'authenticated'
      ? 'Connected'
      : authStatus === 'checking'
        ? 'Checking'
        : 'Sign in'
  const daemonStatusLabel =
    daemonStatus === 'ready'
      ? 'Connected'
      : daemonStatus === 'checking'
        ? 'Checking'
        : daemonStatus === 'error'
          ? 'Error'
          : 'Not connected'

  return (
    <>
      <header className="app-header">
        <div className="header-brand">
          <p className="header-eyebrow">GitHub Access Map</p>
          <p className="header-title">Connection hub</p>
        </div>
        <div className="header-menu">
          <button
            className="menu-button"
            type="button"
            onClick={() => {
              setIsAuthModalOpen(true)
              setIsDaemonModalOpen(false)
            }}
          >
            <span>GitHub connection</span>
            <span className={`menu-status ${authStatus}`}>{authStatusLabel}</span>
          </button>
          <button
            className="menu-button"
            type="button"
            onClick={() => {
              setIsDaemonModalOpen(true)
              setIsAuthModalOpen(false)
            }}
          >
            <span>Git daemon</span>
            <span className={`menu-status ${daemonStatus}`}>{daemonStatusLabel}</span>
          </button>
        </div>
      </header>

      <ModalShell
        isOpen={isAuthModalOpen}
        ariaLabel="GitHub connection"
        onClose={() => setIsAuthModalOpen(false)}
        closeLabel="Close GitHub connection"
      >
        <AuthPanel
          status={authStatus}
          loading={loading}
          canLoad={canRefresh}
          onLogin={onLogin}
          onLogout={onLogout}
          onLoadAccess={onLoadAccess}
        />
      </ModalShell>

      <ModalShell
        isOpen={isDaemonModalOpen}
        ariaLabel="Git daemon"
        onClose={() => setIsDaemonModalOpen(false)}
        closeLabel="Close Git daemon"
      >
        <GitDaemonPanel
          baseUrl={daemonBaseUrl}
          status={daemonStatus}
          error={daemonError}
          meta={daemonMeta}
          pairing={pairing}
          pairCode={pairCode}
          hasToken={hasToken}
          onBaseUrlChange={onBaseUrlChange}
          onConnect={onConnect}
          onPairStart={onPairStart}
          onPairConfirm={onPairConfirm}
          onForgetToken={onForgetToken}
          onPairCodeChange={onPairCodeChange}
        />
      </ModalShell>
    </>
  )
}

export default ConnectionsHub

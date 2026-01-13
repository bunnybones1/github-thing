import { useEffect, useRef, useState } from 'react'
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
  daemonIsThinking: boolean
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
  daemonIsThinking,
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
  const [isBlinking, setIsBlinking] = useState(false)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const headerRef = useRef<HTMLElement | null>(null)
  const blinkTimeoutRef = useRef<number | null>(null)
  const isBlinkingActiveRef = useRef(false)
  const isBlinkingRef = useRef(false)

  const authStatusLabel =
    authStatus === 'authenticated'
      ? 'Connected'
      : authStatus === 'checking'
        ? 'Checking'
        : 'Sign in'
  const needsPairing =
    daemonStatus === 'ready' && daemonMeta?.pairing.required && !hasToken
  const daemonStatusTone = needsPairing ? 'checking' : daemonStatus
  const daemonUiState =
    daemonStatus === 'error'
      ? 'error'
      : daemonStatus === 'checking' || daemonIsThinking
        ? 'thinking'
        : needsPairing
          ? 'waking'
          : daemonStatus === 'ready'
            ? 'ready'
            : 'sleeping'
  const daemonStatusLabelMap = {
    error: 'Error',
    thinking: 'Checking',
    waking: 'Pairing required',
    ready: 'Connected',
    sleeping: 'Not connected',
  } as const
  const daemonRobotSrcMap = {
    error: '/git-daemon/error.png',
    thinking: '/git-daemon/thinking.png',
    waking: '/git-daemon/waking.png',
    ready: isBlinking ? '/git-daemon/normal-blink.png' : '/git-daemon/normal.png',
    sleeping: '/git-daemon/sleeping.png',
  } as const
  const daemonStatusLabel = daemonStatusLabelMap[daemonUiState]
  const daemonRobotSrc = daemonRobotSrcMap[daemonUiState]

  useEffect(() => {
    const clearBlinkTimeout = () => {
      if (blinkTimeoutRef.current === null) return
      window.clearTimeout(blinkTimeoutRef.current)
      blinkTimeoutRef.current = null
    }
    const setBlinking = (value: boolean) => {
      isBlinkingRef.current = value
      setIsBlinking(value)
    }
    const stopBlinking = () => {
      if (!isBlinkingRef.current) return
      isBlinkingRef.current = false
      window.setTimeout(() => {
        setIsBlinking(false)
      }, 0)
    }

    if (daemonStatus !== 'ready' || daemonIsThinking || needsPairing) {
      isBlinkingActiveRef.current = false
      clearBlinkTimeout()
      stopBlinking()
      return
    }

    isBlinkingActiveRef.current = true

    const scheduleBlink = () => {
      if (!isBlinkingActiveRef.current) return
      const nextDelay = 3200 + Math.random() * 4200
      blinkTimeoutRef.current = window.setTimeout(() => {
        if (!isBlinkingActiveRef.current) return
        setBlinking(true)
        blinkTimeoutRef.current = window.setTimeout(() => {
          setBlinking(false)
          scheduleBlink()
        }, 160)
      }, nextDelay)
    }

    stopBlinking()
    scheduleBlink()

    return () => {
      isBlinkingActiveRef.current = false
      clearBlinkTimeout()
    }
  }, [daemonIsThinking, daemonStatus, needsPairing])

  useEffect(() => {
    const headerEl = headerRef.current
    if (!headerEl || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry.isIntersecting)
      },
      { threshold: 0.15 },
    )
    observer.observe(headerEl)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header className="app-header" ref={headerRef}>
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
            className="menu-button menu-button-daemon"
            type="button"
            onClick={() => {
              setIsDaemonModalOpen(true)
              setIsAuthModalOpen(false)
            }}
          >
            <span>Git daemon</span>
            <span className={`menu-status ${daemonStatusTone}`}>{daemonStatusLabel}</span>
            <img
              className="daemon-robot"
              src={daemonRobotSrc}
              alt=""
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {!isHeaderVisible ? (
        <button
          className="daemon-floater"
          type="button"
          aria-label={`Open Git daemon (${daemonStatusLabel})`}
          onClick={() => {
            setIsDaemonModalOpen(true)
            setIsAuthModalOpen(false)
          }}
        >
          <img className="daemon-robot" src={daemonRobotSrc} alt="" aria-hidden="true" />
        </button>
      ) : null}

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

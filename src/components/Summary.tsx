import type { GitHubUser } from '../types'

type SummaryProps = {
  profile: GitHubUser
  orgCount: number
  repoCount: number
  onRefresh: () => void
  canRefresh: boolean
  loading: boolean
  lastUpdatedLabel: string | null
}

const Summary = ({
  profile,
  orgCount,
  repoCount,
  onRefresh,
  canRefresh,
  loading,
  lastUpdatedLabel,
}: SummaryProps) => (
  <section className="summary">
    <div className="summary-main">
      <p className="summary-title">Signed in as</p>
      <h2>{profile.login}</h2>
      <p className="summary-subtitle">{profile.name || 'GitHub user'}</p>
    </div>
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
    <div className="summary-actions">
      <button
        className="button ghost"
        type="button"
        onClick={onRefresh}
        disabled={!canRefresh}
      >
        {loading ? 'Refreshing...' : 'Refresh data'}
      </button>
      {lastUpdatedLabel ? (
        <p className="summary-updated">Last updated {lastUpdatedLabel}</p>
      ) : null}
    </div>
  </section>
)

export default Summary

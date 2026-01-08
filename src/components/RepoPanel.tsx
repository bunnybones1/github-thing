import { formatDate } from '../lib/format'
import type { GitHubRepo } from '../types'

type RepoPanelProps = {
  repos: GitHubRepo[]
}

const RepoPanel = ({ repos }: RepoPanelProps) => (
  <section className="panel">
    <div className="panel-header">
      <h3>Repositories</h3>
      <span className="pill">{repos.length} total</span>
    </div>
    {repos.length ? (
      <ul className="list">
        {repos.map((repo) => (
          <li key={repo.id}>
            <div className="repo-row">
              <a href={repo.html_url} target="_blank" rel="noreferrer">
                {repo.full_name}
              </a>
              <span className={`badge ${repo.private ? 'private' : 'public'}`}>
                {repo.private ? 'Private' : 'Public'}
              </span>
            </div>
            <div className="repo-meta">
              <span>{repo.language || 'Unknown language'}</span>
              <span>Updated {formatDate(repo.updated_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="empty">No repositories loaded yet.</p>
    )}
  </section>
)

export default RepoPanel

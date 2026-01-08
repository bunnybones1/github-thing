import type { GitHubOrg } from '../types'

type OrgPanelProps = {
  orgs: GitHubOrg[]
}

const OrgPanel = ({ orgs }: OrgPanelProps) => (
  <section className="panel">
    <div className="panel-header">
      <h3>Organizations</h3>
      <span className="pill">{orgs.length} total</span>
    </div>
    {orgs.length ? (
      <ul className="list">
        {orgs.map((org) => (
          <li key={org.id}>
            <a href={org.html_url} target="_blank" rel="noreferrer">
              {org.login}
            </a>
            <span className="muted">{org.description || 'No description'}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="empty">No organizations loaded yet.</p>
    )}
  </section>
)

export default OrgPanel

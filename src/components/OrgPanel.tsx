import { PERSONAL_OTHER_KEY, PERSONAL_SELF_KEY } from '../lib/constants'
import type { GitHubOrg } from '../types'

type OrgPanelProps = {
  orgs: GitHubOrg[]
  visibility: Record<string, boolean>
  personalVisibility: {
    self: boolean
    other: boolean
  }
  profileLogin: string | null
  onToggle: (login: string) => void
}

const OrgPanel = ({
  orgs,
  visibility,
  personalVisibility,
  profileLogin,
  onToggle,
}: OrgPanelProps) => (
  <section className="panel">
    <div className="panel-header">
      <h3>Organizations</h3>
      <span className="pill">{orgs.length} total</span>
    </div>
    <ul className="list">
      <li>
        <div className="org-row">
          <div className="org-info">
            <span className="org-title">Personal (yours)</span>
            <span className="muted">Repos owned by {profileLogin || 'you'}</span>
          </div>
          <button
            type="button"
            className={`org-toggle ${personalVisibility.self ? 'on' : 'off'}`}
            onClick={() => onToggle(PERSONAL_SELF_KEY)}
            aria-pressed={personalVisibility.self}
            aria-label="Toggle personal (yours)"
          >
            {personalVisibility.self ? 'On' : 'Off'}
          </button>
        </div>
      </li>
      <li>
        <div className="org-row">
          <div className="org-info">
            <span className="org-title">Personal (others)</span>
            <span className="muted">Repos owned by outside collaborators</span>
          </div>
          <button
            type="button"
            className={`org-toggle ${personalVisibility.other ? 'on' : 'off'}`}
            onClick={() => onToggle(PERSONAL_OTHER_KEY)}
            aria-pressed={personalVisibility.other}
            aria-label="Toggle personal (others)"
          >
            {personalVisibility.other ? 'On' : 'Off'}
          </button>
        </div>
      </li>
      {orgs.map((org) => (
        <li key={org.id}>
          <div className="org-row">
            <div className="org-info">
              <a href={org.html_url} target="_blank" rel="noreferrer">
                {org.login}
              </a>
              <span className="muted">{org.description || 'No description'}</span>
            </div>
            <button
              type="button"
              className={`org-toggle ${visibility[org.login] ? 'on' : 'off'}`}
              onClick={() => onToggle(org.login)}
              aria-pressed={visibility[org.login]}
              aria-label={`Toggle ${org.login}`}
            >
              {visibility[org.login] ? 'On' : 'Off'}
            </button>
          </div>
        </li>
      ))}
    </ul>
    {!orgs.length ? <p className="empty">No organizations loaded yet.</p> : null}
  </section>
)

export default OrgPanel

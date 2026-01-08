import { REPO_COLUMNS } from '../lib/repoColumns'
import type { RepoColumnKey, RepoColumnVisibility } from '../lib/repoColumns'

type ColumnConfigPanelProps = {
  isOpen: boolean
  visibility: RepoColumnVisibility
  onToggle: (key: RepoColumnKey) => void
  onReset: () => void
}

const ColumnConfigPanel = ({
  isOpen,
  visibility,
  onToggle,
  onReset,
}: ColumnConfigPanelProps) => {
  if (!isOpen) return null
  return (
    <div
      className="config-panel"
      role="dialog"
      aria-label="Column visibility"
      id="column-config-panel"
    >
      <div className="config-header">
        <div>
          <p className="config-title">Visible columns</p>
          <p className="config-subtitle">Hide or show columns for the repo table.</p>
        </div>
        <button type="button" className="config-reset" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="config-list">
        {REPO_COLUMNS.map(({ key, label }) => {
          const isVisible = visibility[key] ?? true
          const isLocked = key === 'name'
          return (
            <button
              key={key}
              type="button"
              className={`config-toggle ${isVisible ? 'on' : 'off'} ${
                isLocked ? 'locked' : ''
              }`}
              onClick={() => {
                if (isLocked) return
                onToggle(key)
              }}
              aria-pressed={isVisible}
              disabled={isLocked}
            >
              <span>{label}</span>
              <span className="config-state">
                {isLocked ? 'Required' : isVisible ? 'On' : 'Off'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ColumnConfigPanel

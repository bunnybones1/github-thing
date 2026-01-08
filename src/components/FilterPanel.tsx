export type RepoFilters = {
  hideArchived: boolean
  hidePrivate: boolean
  hidePublic: boolean
}

type FilterPanelProps = {
  isOpen: boolean
  filters: RepoFilters
  onToggle: (key: keyof RepoFilters) => void
  onReset: () => void
}

const FilterPanel = ({ isOpen, filters, onToggle, onReset }: FilterPanelProps) => {
  if (!isOpen) return null
  return (
    <div className="config-panel" role="dialog" aria-label="Repository filters">
      <div className="config-header">
        <div>
          <p className="config-title">Filters</p>
          <p className="config-subtitle">Narrow down repositories by status.</p>
        </div>
        <button type="button" className="config-reset" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="config-list">
        <button
          type="button"
          className={`config-toggle ${filters.hideArchived ? 'on' : 'off'}`}
          onClick={() => onToggle('hideArchived')}
          aria-pressed={filters.hideArchived}
        >
          <span>Hide archived</span>
          <span className="config-state">{filters.hideArchived ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          className={`config-toggle ${filters.hidePrivate ? 'on' : 'off'}`}
          onClick={() => onToggle('hidePrivate')}
          aria-pressed={filters.hidePrivate}
        >
          <span>Hide private</span>
          <span className="config-state">{filters.hidePrivate ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          className={`config-toggle ${filters.hidePublic ? 'on' : 'off'}`}
          onClick={() => onToggle('hidePublic')}
          aria-pressed={filters.hidePublic}
        >
          <span>Hide public</span>
          <span className="config-state">{filters.hidePublic ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  )
}

export default FilterPanel

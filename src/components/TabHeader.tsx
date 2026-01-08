type TabHeaderProps = {
  activeTab: 'orgs' | 'repos'
  onTabChange: (tab: 'orgs' | 'repos') => void
  showConfig: boolean
  showFilters: boolean
  hiddenCount: number
  filterCount: number
  onToggleConfig: () => void
  onToggleFilters: () => void
  configEnabled: boolean
  filterValue: string
  onFilterChange: (value: string) => void
}

const TabHeader = ({
  activeTab,
  onTabChange,
  showConfig,
  showFilters,
  hiddenCount,
  filterCount,
  onToggleConfig,
  onToggleFilters,
  configEnabled,
  filterValue,
  onFilterChange,
}: TabHeaderProps) => (
  <div className="panel-tabs-row">
    <div className="panel-tabs" role="tablist" aria-label="Access views">
      <button
        type="button"
        className={`tab-button ${activeTab === 'orgs' ? 'active' : ''}`}
        onClick={() => onTabChange('orgs')}
        role="tab"
        aria-selected={activeTab === 'orgs'}
      >
        Organizations
      </button>
      <button
        type="button"
        className={`tab-button ${activeTab === 'repos' ? 'active' : ''}`}
        onClick={() => onTabChange('repos')}
        role="tab"
        aria-selected={activeTab === 'repos'}
      >
        Repositories
      </button>
    </div>
    {configEnabled ? (
      <div className="repo-filter">
        <input
          type="search"
          value={filterValue}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Filter repositories..."
          aria-label="Filter repositories"
        />
      </div>
    ) : null}
    <div className="tab-actions">
      <button
        type="button"
        className="config-button ghost"
        onClick={onToggleFilters}
        aria-expanded={showFilters}
        aria-haspopup="dialog"
        aria-controls="filter-panel"
        disabled={!configEnabled}
      >
        Filters
        {filterCount > 0 && configEnabled ? (
          <span className="config-badge">{filterCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        className="config-button"
        onClick={onToggleConfig}
        aria-expanded={showConfig}
        aria-haspopup="dialog"
        aria-controls="column-config-panel"
        disabled={!configEnabled}
      >
        Columns
        {hiddenCount > 0 && configEnabled ? (
          <span className="config-badge">{hiddenCount}</span>
        ) : null}
      </button>
    </div>
  </div>
)

export default TabHeader

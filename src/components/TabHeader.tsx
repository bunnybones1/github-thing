type TabHeaderProps = {
  activeTab: 'orgs' | 'repos'
  onTabChange: (tab: 'orgs' | 'repos') => void
  showConfig: boolean
  hiddenCount: number
  onToggleConfig: () => void
  configEnabled: boolean
}

const TabHeader = ({
  activeTab,
  onTabChange,
  showConfig,
  hiddenCount,
  onToggleConfig,
  configEnabled,
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
)

export default TabHeader

type CacheNoticeProps = {
  isCached: boolean
  lastUpdatedLabel: string | null
}

const CacheNotice = ({ isCached, lastUpdatedLabel }: CacheNoticeProps) => {
  if (!isCached || !lastUpdatedLabel) return null
  return (
    <div className="alert info">
      Showing cached data from {lastUpdatedLabel}. Click refresh to fetch the latest.
    </div>
  )
}

export default CacheNotice

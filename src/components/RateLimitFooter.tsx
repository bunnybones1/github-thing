import { formatResetTime } from '../lib/format'
import type { RateLimitInfo } from '../types'

type RateLimitFooterProps = {
  rateLimit: RateLimitInfo | null
  isOpen: boolean
  onToggle: () => void
}

const RateLimitFooter = ({ rateLimit, isOpen, onToggle }: RateLimitFooterProps) => (
  <footer className="footer">
    <button
      type="button"
      className="footer-toggle"
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      Rate limit info
      <span className={`chevron ${isOpen ? 'open' : ''}`} aria-hidden>
        ▼
      </span>
    </button>
    {isOpen ? (
      <div className="footer-panel">
        {rateLimit ? (
          <div className="rate-grid">
            <div>
              <p className="rate-label">Remaining</p>
              <p className="rate-value">
                {rateLimit.remaining} / {rateLimit.limit}
              </p>
            </div>
            <div>
              <p className="rate-label">Resets</p>
              <p className="rate-value">{formatResetTime(rateLimit.reset)}</p>
            </div>
            {rateLimit.used !== null ? (
              <div>
                <p className="rate-label">Used</p>
                <p className="rate-value">{rateLimit.used}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rate-empty">Fetch data to see rate limit status.</p>
        )}
      </div>
    ) : null}
  </footer>
)

export default RateLimitFooter

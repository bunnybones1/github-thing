import Hero from './Hero'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import { SPLASH_DISMISSED_KEY } from '../lib/constants'

const SplashModal = () => {
  const [isDismissed, setIsDismissed] = useLocalStorageState(SPLASH_DISMISSED_KEY, false)

  if (isDismissed) return null

  return (
    <div className="splash-overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="splash-modal">
        <Hero />
        <div className="splash-actions">
          <button
            className="button primary"
            type="button"
            onClick={() => setIsDismissed(true)}
          >
            Begin
          </button>
        </div>
      </div>
    </div>
  )
}

export default SplashModal

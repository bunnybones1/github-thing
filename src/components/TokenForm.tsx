import type { FormEvent } from 'react'

type TokenFormProps = {
  token: string
  showToken: boolean
  loading: boolean
  onTokenChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleShow: () => void
  onClearToken: () => void
}

const TokenForm = ({
  token,
  showToken,
  loading,
  onTokenChange,
  onSubmit,
  onToggleShow,
  onClearToken,
}: TokenFormProps) => (
  <form className="token-form" onSubmit={onSubmit}>
    <label htmlFor="token">Personal access token</label>
    <div className="token-row">
      <input
        id="token"
        className="token-input"
        type={showToken ? 'text' : 'password'}
        placeholder="ghp_..."
        autoComplete="off"
        value={token}
        onChange={(event) => onTokenChange(event.target.value)}
      />
      <button type="button" className="button ghost" onClick={onToggleShow}>
        {showToken ? 'Hide' : 'Show'}
      </button>
      <button
        type="button"
        className="button ghost"
        onClick={onClearToken}
        disabled={!token}
      >
        Clear
      </button>
      <button className="button primary" type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Load access'}
      </button>
    </div>
    <p className="hint">
      We read from <code>api.github.com</code>. Tokens are stored locally until you clear
      them.
    </p>
  </form>
)

export default TokenForm

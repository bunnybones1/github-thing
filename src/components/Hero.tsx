const Hero = () => (
  <header className="hero">
    <div>
      <p className="eyebrow">GitHub Access Map</p>
      <h1>List every org and repo you can reach</h1>
      <p className="lead">
        Sign in with GitHub to map your organization memberships and repository access in
        one view.
      </p>
    </div>
    <div className="hero-card">
      <h2>How access works</h2>
      <p>
        Sign in with GitHub OAuth. We store a session in a secure httpOnly cookie and
        never keep your token in the browser.
      </p>
      <p className="hero-note">
        Scopes requested: <code>read:org</code>, <code>read:user</code>, <code>repo</code>
        .
      </p>
    </div>
  </header>
)

export default Hero

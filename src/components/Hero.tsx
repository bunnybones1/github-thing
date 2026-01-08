const Hero = () => (
  <header className="hero">
    <div>
      <p className="eyebrow">GitHub Access Map</p>
      <h1>List every org and repo you can reach</h1>
      <p className="lead">
        Paste a GitHub personal access token to map your organization memberships and
        repository access in one view.
      </p>
    </div>
    <div className="hero-card">
      <h2>Token checklist</h2>
      <ul>
        <li>
          Classic token: use the <strong>read:org</strong> scope.
        </li>
        <li>Fine-grained token: allow org membership + repo read.</li>
        <li>Tokens stay in your browser and can be cleared anytime.</li>
      </ul>
    </div>
  </header>
)

export default Hero

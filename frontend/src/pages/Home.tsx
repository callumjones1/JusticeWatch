import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Digital Research Infrastructure</span>
          <h1>Justice Watch Network</h1>
          <p className="hero-subtitle">
            Tracking prosecutions arising from political violence and civil protest in Australia,
            and the public political discourse surrounding them, 2000–present
          </p>
          <div className="hero-buttons">
            <Link to="/projects" className="btn btn-primary">Explore Projects</Link>
            <Link to="/about" className="btn btn-secondary">Learn More</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">About the Project</h2>
          <div className="section-divider"></div>
          <p className="section-text">
            The Justice Watch Network is an open-source digital research infrastructure documenting
            prosecutions arising from civil protest and political violence in Australia—and the
            contested terrain between them—from 2000 to the present. Alongside the case record we
            archive news media reporting and public commentary on these cases and on the political
            discourse surrounding them. All source material is publicly available: court judgments,
            legislative documents, government statements and published news reporting. The platform
            gives researchers, legal practitioners, policymakers, journalists and community
            organisations an accessible, citable evidence base on how the justice system responds
            to political expression.
          </p>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">What We Do</h2>
          <div className="section-divider"></div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h3>Document Cases</h3>
              <p>We systematically document prosecutions arising from civil protest and political violence across every Australian jurisdiction—federal, state and territory—with full source provenance on every record.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <h3>Analyse Trends</h3>
              <p>Our research team analyses patterns in charging practice, sentencing outcomes and judicial interpretation—and how news media framing of these cases diverges from their legal categorisation.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Open Access</h3>
              <p>Our records, sources and coding methods are openly published, so communities, practitioners and researchers can use and cite the same evidence base.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Our Coverage</h2>
          <div className="section-divider"></div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-number">2000</span>
              <span className="stat-label">Coverage Begins</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">9</span>
              <span className="stat-label">Jurisdictions</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">Open</span>
              <span className="stat-label">Source Material</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-cta">
        <div className="container">
          <h2>Get Involved</h2>
          <p>The Justice Watch Network is testing the platform with legal advocacy and civil liberties organisations, community legal centres, journalists and researchers. If your organisation would like to take part in user testing, use our data, or tell us about a case or incident we have missed, we would like to hear from you.</p>
          <Link to="/contact" className="btn btn-primary">Contact Us</Link>
        </div>
      </section>
    </div>
  );
}

import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Justice Watch Network</h1>
          <p className="hero-subtitle">
            Tracking prosecutions linked to political violence and civil activism
            in Australia and New Zealand-Aotearoa
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
          <p className="section-text">
            The Justice Watch Network is a comprehensive, open-source platform dedicated to tracking
            and analysing prosecutions linked to political violence and civil activism from 2001 to
            the present. Our database provides researchers, journalists, and the public with
            accessible information about how the justice system responds to politically-motivated cases.
          </p>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">What We Do</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h3>Document Cases</h3>
              <p>We systematically document prosecutions related to political violence and activism across Australia and New Zealand.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <h3>Analyse Trends</h3>
              <p>Our research team analyses patterns in prosecution decisions, sentencing outcomes, and legal strategies.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Open Access</h3>
              <p>All our data and research is freely available to support transparency and public understanding.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Our Coverage</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-number">2001</span>
              <span className="stat-label">Coverage Begins</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">2</span>
              <span className="stat-label">Countries</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">Open</span>
              <span className="stat-label">Data Access</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-cta">
        <div className="container">
          <h2>Get Involved</h2>
          <p>Interested in our research or want to contribute? We welcome collaboration from researchers, journalists, and civil society organisations.</p>
          <Link to="/contact" className="btn btn-primary">Contact Us</Link>
        </div>
      </section>
    </div>
  );
}

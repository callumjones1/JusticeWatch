import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import logoImg from '../assets/justice_watch_logo_blue_cropped-transparent.png';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dbOpen, setDbOpen] = useState(false);
  const dbRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const dbActive = location.pathname.startsWith('/databases');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dbRef.current && !dbRef.current.contains(e.target as Node)) {
        setDbOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo">
            <img src={logoImg} alt="Justice Watch Network" className="logo-img" />
          </Link>

          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${menuOpen ? 'open' : ''}`}></span>
          </button>

          <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              About
            </NavLink>
            <NavLink to="/team" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              Team
            </NavLink>
            <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              Projects
            </NavLink>

            {/* Databases dropdown */}
            <div className={`nav-dropdown${dbOpen ? ' nav-dropdown-open' : ''}`} ref={dbRef}>
              <button
                className={`nav-link nav-dropdown-trigger${dbActive ? ' active' : ''}`}
                onClick={() => setDbOpen(o => !o)}
                aria-expanded={dbOpen}
              >
                Databases
                <svg className="nav-dropdown-caret" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="nav-dropdown-menu">
                <NavLink
                  to="/databases/legislation"
                  className={({ isActive }) => isActive ? 'nav-dropdown-item active' : 'nav-dropdown-item'}
                  onClick={() => { setDbOpen(false); setMenuOpen(false); }}
                >
                  Legislation Tracker
                </NavLink>
                <NavLink
                  to="/databases/incidents"
                  className={({ isActive }) => isActive ? 'nav-dropdown-item active' : 'nav-dropdown-item'}
                  onClick={() => { setDbOpen(false); setMenuOpen(false); }}
                >
                  Incidents Tracker
                </NavLink>
                <NavLink
                  to="/databases/cases"
                  className={({ isActive }) => isActive ? 'nav-dropdown-item active' : 'nav-dropdown-item'}
                  onClick={() => { setDbOpen(false); setMenuOpen(false); }}
                >
                  Cases
                </NavLink>
                <NavLink
                  to="/databases/media"
                  className={({ isActive }) => isActive ? 'nav-dropdown-item active' : 'nav-dropdown-item'}
                  onClick={() => { setDbOpen(false); setMenuOpen(false); }}
                >
                  News Media Coverage
                </NavLink>
              </div>
            </div>

            <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              Analytics
            </NavLink>

            <NavLink to="/faq" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              FAQ
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
              Contact
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-section">
              <h3>Justice Watch Network</h3>
              <p>Tracking prosecutions arising from political violence and civil protest in Australia, and the public political discourse surrounding them.</p>
              <p>A Deakin University research initiative, supported by the Faculty of Arts and Education Research Project Development Scheme. Spotted an error? <Link to="/contact">Get in touch</Link>.</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/about">About Us</Link></li>
                <li><Link to="/projects">Projects</Link></li>
                <li><Link to="/faq">FAQ</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: info@justicewatchnetwork.org</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Justice Watch Network. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

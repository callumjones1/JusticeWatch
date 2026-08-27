import { Link } from 'react-router-dom';

export default function Projects() {
  const projects = [
    {
      id: 'prosecution-database',
      title: 'Prosecution Database',
      description: 'Our register of prosecutions arising from political violence and civil protest across every Australian jurisdiction, with standardised case summaries, charge-level outcomes, linked legislation and full source provenance.',
      status: 'Active',
    },
    {
      id: 'annual-reports',
      title: 'Annual Reports',
      description: "A yearly securitisation snapshot: new legislation, prosecution counts, notable outcomes and the dominant media frames of the year, drawn from the platform's aggregate data.",
      status: 'In Development',
    },
    {
      id: 'case-studies',
      title: 'Key Incidents',
      description: 'In-depth dossiers on significant incidents and case clusters—landmark prosecutions, novel uses of legislation, and moments where the boundary between protest and political violence was legally contested—setting the legal, news media and public commentary record side by side.',
      status: 'In Development',
    },
  ];

  return (
    <div className="projects-page">
      <section className="page-header">
        <div className="container">
          <h1>Projects</h1>
          <p className="page-subtitle">Explore our research initiatives and resources</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="projects-intro">
            <p>
              The Justice Watch Network undertakes a range of research projects documenting and
              analysing prosecutions arising from political violence and civil protest, and the
              public political discourse surrounding them. Below you'll find our current and
              planned initiatives.
            </p>
          </div>

          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-status">
                  <span className={`status-badge status-${project.status.toLowerCase().replace(' ', '-')}`}>
                    {project.status}
                  </span>
                </div>
                <h3 className="project-title">{project.title}</h3>
                <p className="project-description">{project.description}</p>
                <Link to={`/projects/${project.id}`} className="project-link">
                  Learn More
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
              </div>
            ))}
          </div>

          <div className="content-block">
            <h2>Data Access</h2>
            <p>
              We are committed to open access. Every record on this site is published with its
              sources and can be cited directly, and filtered result sets will be exportable as
              CSV and JSON for research, journalism and educational purposes. Bulk dataset
              downloads are in preparation and will be released together with the data use
              guidelines and the codebook that governs how records are coded. In the meantime,
              researchers and partner organisations can contact us to discuss access.
            </p>
            <div className="cta-buttons">
              <button className="btn btn-primary" disabled>
                Bulk download—in preparation
              </button>
              <Link to="/faq" className="btn btn-secondary">
                Data Use Guidelines
              </Link>
              <Link to="/contact" className="btn btn-secondary">
                Contact us about access
              </Link>
            </div>
          </div>

          <div className="content-block">
            <h2>Suggest a Project</h2>
            <p>
              Have an idea for research that aligns with our mission? We welcome
              suggestions and collaboration proposals from researchers, civil society
              organisations, and journalists.
            </p>
            <Link to="/contact" className="btn btn-secondary">
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

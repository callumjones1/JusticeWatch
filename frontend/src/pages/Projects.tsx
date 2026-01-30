import { Link } from 'react-router-dom';

export default function Projects() {
  const projects = [
    {
      id: 'prosecution-database',
      title: 'Prosecution Database',
      description: 'Our comprehensive database tracking criminal prosecutions related to political violence and activism across Australia and New Zealand.',
      status: 'Active',
    },
    {
      id: 'annual-reports',
      title: 'Annual Reports',
      description: 'Yearly analysis of trends in prosecutions, sentencing patterns, and legal developments in politically-motivated cases.',
      status: 'Ongoing',
    },
    {
      id: 'case-studies',
      title: 'Case Studies',
      description: 'In-depth examinations of significant prosecutions that illuminate broader patterns in how the justice system responds to political cases.',
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
              The Justice Watch Network undertakes a range of research projects aimed at
              documenting, analysing, and understanding prosecutions related to political
              violence and civil activism. Below you'll find our current and planned initiatives.
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
              We are committed to open access. Our datasets are available for download
              for research, journalism, and educational purposes. Please review our
              data use guidelines before downloading.
            </p>
            <div className="cta-buttons">
              <button className="btn btn-primary" disabled>
                Download Dataset (Coming Soon)
              </button>
              <Link to="/faq" className="btn btn-secondary">
                Data Use Guidelines
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

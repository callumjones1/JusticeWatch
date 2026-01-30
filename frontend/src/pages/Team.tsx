export default function Team() {
  const teamMembers = [
    {
      name: 'Team Member Name',
      role: 'Principal Investigator',
      bio: 'Brief biography about this team member, their background, expertise, and role in the project.',
      image: null,
    },
    {
      name: 'Team Member Name',
      role: 'Research Director',
      bio: 'Brief biography about this team member, their background, expertise, and role in the project.',
      image: null,
    },
    {
      name: 'Team Member Name',
      role: 'Data Analyst',
      bio: 'Brief biography about this team member, their background, expertise, and role in the project.',
      image: null,
    },
    {
      name: 'Team Member Name',
      role: 'Research Assistant',
      bio: 'Brief biography about this team member, their background, expertise, and role in the project.',
      image: null,
    },
  ];

  return (
    <div className="team-page">
      <section className="page-header">
        <div className="container">
          <h1>Our Team</h1>
          <p className="page-subtitle">Meet the researchers behind the Justice Watch Network</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="team-intro">
            <p>
              The Justice Watch Network brings together researchers, legal experts, and data
              specialists committed to documenting and analysing prosecutions related to
              political violence and activism. Our interdisciplinary team combines expertise
              in law, criminology, political science, and data analysis.
            </p>
          </div>

          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div key={index} className="team-card">
                <div className="team-avatar">
                  {member.image ? (
                    <img src={member.image} alt={member.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="team-name">{member.name}</h3>
                <p className="team-role">{member.role}</p>
                <p className="team-bio">{member.bio}</p>
              </div>
            ))}
          </div>

          <div className="content-block">
            <h2>Advisory Board</h2>
            <p>
              Our work is guided by an advisory board of distinguished academics and
              practitioners who provide strategic direction and ensure the quality and
              relevance of our research.
            </p>
            <ul className="advisor-list">
              <li><strong>Advisor Name</strong> - Institution/Organisation</li>
              <li><strong>Advisor Name</strong> - Institution/Organisation</li>
              <li><strong>Advisor Name</strong> - Institution/Organisation</li>
            </ul>
          </div>

          <div className="content-block">
            <h2>Collaborating Institutions</h2>
            <p>
              We work closely with universities, research centres, and civil society
              organisations across Australia and New Zealand. These partnerships enhance
              our research capabilities and extend the reach of our work.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

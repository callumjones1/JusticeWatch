export default function Team() {
  const teamMembers = [
    {
      name: 'Dr Imogen Richards',
      role: 'Convenor',
      bio: "Senior Lecturer in Criminology in the School of Humanities and Social Sciences at Deakin University, and convenor of the Justice Watch Network. She holds editorial responsibility for the platform's records.",
      image: null,
    },
    {
      name: 'Dr Callum Jones',
      role: 'Technical Lead',
      bio: 'Security studies and policy analysis. Technical lead for the full-stack development of the platform, along with the design of the accompanying analytics.',
      image: null,
    },
    {
      name: 'Cam Smith',
      role: 'Public Information Analyst',
      bio: 'Public information analysis and communications. Co-developed and operates the news media and case identification pipelines that populate the platform.',
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
              The Justice Watch Network is convened at Deakin University by a small
              interdisciplinary core team, spanning criminology and socio-legal analysis, security
              studies and policy analysis, database and language-model development, and media
              monitoring and public information analysis.
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
              An advisory board, including legal expertise, is being established as the network
              matures. Until it is in place, editorial responsibility rests with the convenor and
              disputed records are decided by the core team.
            </p>
          </div>

          <div className="content-block">
            <h2>Collaborating Institutions</h2>
            <p>
              The Justice Watch Network is based in the School of Humanities and Social Sciences
              at Deakin University, with seed funding from the Faculty of Arts and Education. We
              are developing structured testing and partnership relationships with civil society
              and legal advocacy organisations, community legal centres, journalists and
              researchers, whose feedback shapes the platform's design and priorities. The team
              also maintains active international research collaborations across Europe and North
              America.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

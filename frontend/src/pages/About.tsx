export default function About() {
  return (
    <div className="about-page">
      <section className="page-header">
        <div className="container">
          <h1>About Us</h1>
          <p className="page-subtitle">Understanding our mission and methodology</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="content-block">
            <h2>Our Mission</h2>
            <p>
              The Justice Watch Network is dedicated to promoting transparency and understanding
              in how the justice systems of Australia and New Zealand-Aotearoa respond to cases
              involving political violence and civil activism. Through systematic documentation
              and rigorous analysis, we aim to provide valuable insights for researchers,
              policymakers, journalists, and the public.
            </p>
          </div>

          <div className="content-block">
            <h2>What We Track</h2>
            <p>
              Our database focuses on criminal prosecutions that have a nexus to political
              violence, terrorism, and civil activism. This includes:
            </p>
            <ul className="content-list">
              <li>Cases involving charges related to terrorism or politically-motivated violence</li>
              <li>Prosecutions arising from protest activities and civil disobedience</li>
              <li>Cases involving extremist ideologies across the political spectrum</li>
              <li>Incidents where political motivations were a factor in criminal proceedings</li>
            </ul>
          </div>

          <div className="content-block">
            <h2>Our Methodology</h2>
            <p>
              We employ a systematic approach to data collection and verification:
            </p>
            <ul className="content-list">
              <li><strong>Source Verification:</strong> All cases are documented using primary sources including court records, official government documents, and verified news reports.</li>
              <li><strong>Consistent Coding:</strong> We apply standardised coding protocols to ensure consistency across all entries in our database.</li>
              <li><strong>Regular Updates:</strong> Our database is continuously updated as new cases emerge and existing cases progress through the legal system.</li>
              <li><strong>Peer Review:</strong> Our methodology and findings undergo regular review by academic experts and practitioners.</li>
            </ul>
          </div>

          <div className="content-block">
            <h2>Our Values</h2>
            <div className="values-grid">
              <div className="value-card">
                <h3>Transparency</h3>
                <p>We believe in open access to information and make our data freely available to all.</p>
              </div>
              <div className="value-card">
                <h3>Objectivity</h3>
                <p>We document cases without political bias, applying consistent standards across the spectrum.</p>
              </div>
              <div className="value-card">
                <h3>Accuracy</h3>
                <p>We prioritise factual accuracy and regularly verify and update our records.</p>
              </div>
              <div className="value-card">
                <h3>Accessibility</h3>
                <p>We present complex legal information in formats accessible to diverse audiences.</p>
              </div>
            </div>
          </div>

          <div className="content-block">
            <h2>Geographic Scope</h2>
            <p>
              Our current focus is on Australia and New Zealand-Aotearoa. These two nations share
              common legal traditions but have distinct approaches to prosecuting cases involving
              political violence and activism. By documenting cases across both jurisdictions,
              we enable comparative analysis and deeper understanding of regional patterns.
            </p>
          </div>

          <div className="content-block">
            <h2>Time Period</h2>
            <p>
              Our database covers cases from 2001 to the present. This timeframe was chosen to
              capture the significant shifts in counter-terrorism policy and prosecution
              strategies that followed the events of September 11, 2001, while also documenting
              the evolving landscape of political activism and state responses in the region.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

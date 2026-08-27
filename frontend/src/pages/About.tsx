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
              in how Australia's justice system responds to political violence and civil protest,
              and in how these cases are represented in public political discourse. Through
              systematic documentation, versioned coding frameworks and rigorous analysis, we aim
              to provide a shared, citable evidence base for researchers, legal practitioners,
              policymakers, journalists and community organisations.
            </p>
          </div>

          <div className="content-block">
            <h2>What We Track</h2>
            <p>
              Our database focuses on prosecutions that have a nexus to political violence,
              terrorism and civil protest, and on the public political discourse surrounding
              those cases. This includes:
            </p>
            <ul className="content-list">
              <li>Prosecutions involving charges related to terrorism or politically motivated violence, including far-right and neo-jihadist political violence</li>
              <li>Prosecutions arising from civil protest and civil disobedience, and proceedings about the right to protest itself—public assembly applications and constitutional challenges</li>
              <li>Cases where the classification itself was contested—where the boundary between civil protest and political violence was legally in dispute</li>
              <li>The incidents themselves—date, location, type, targets, harms and the justificatory frames invoked—linked to any resulting proceedings</li>
              <li>News media reporting and public commentary on these cases and incidents—news articles, The Conversation pieces, police and ministerial statements, and expert and advocacy commentary—coded for framing and linked to the relevant case or incident. Tracking this discourse alongside the legal record is what lets the platform show where public characterisations of activism and political violence diverge from how the same conduct is actually charged and resolved in court.</li>
            </ul>
          </div>

          <div className="content-block">
            <h2>Our Methodology</h2>
            <p>
              We employ a systematic approach to data collection and verification:
            </p>
            <ul className="content-list">
              <li><strong>Source verification:</strong> Every record is documented from open sources—published court judgments and sentencing remarks, legislation and parliamentary materials, government and police statements, and published news reporting. Every datum carries a link or citation to at least one verifiable public source.</li>
              <li><strong>Consistent coding:</strong> A versioned codebook governs our controlled vocabularies, inclusion criteria and framing codes, and the codebook version is recorded on every record so analyses can be reproduced against the coding rules in force at the time.</li>
              <li><strong>Regular updates:</strong> The database is updated on an ongoing basis as new cases emerge and existing matters progress through the legal system, with a published changelog of new and revised records.</li>
              <li><strong>Review:</strong> Records move from draft to published only after two-pass review by a member of the core team, and our methodology and findings are tested with academic experts, legal practitioners and civil society partners.</li>
            </ul>
          </div>

          <div className="content-block">
            <h2>Our Values</h2>
            <div className="values-grid">
              <div className="value-card">
                <h3>Transparency</h3>
                <p>We believe in open access to information of critical importance to communities, and the website is designed with this in mind.</p>
              </div>
              <div className="value-card">
                <h3>Objectivity</h3>
                <p>We document cases and the public political discourse around them by applying consistent, published standards across the political spectrum.</p>
              </div>
              <div className="value-card">
                <h3>Accuracy</h3>
                <p>We prioritise accuracy, and regularly verify and update our records. Charges are described as allegations until conviction, and acquittals and withdrawals are recorded with the same prominence as charges.</p>
              </div>
              <div className="value-card">
                <h3>Accessibility</h3>
                <p>We present complex legal information in formats accessible to diverse audiences, and build the site to recognised accessibility standards, with data-table alternatives for every visualisation.</p>
              </div>
            </div>
          </div>

          <div className="content-block">
            <h2>Geographic Scope</h2>
            <p>
              Our focus is Australia—federal, state and territory jurisdictions. Jurisdiction is
              treated as a core attribute of every record, so the platform can show where
              particular enforcement approaches concentrate geographically and how comparable
              conduct is charged differently across the country. Beyond documenting cases, the
              platform links each one to the legislation charged under it, to the incident it
              arose from and to the news media and public commentary surrounding it, and presents
              that material through interactive maps, timelines and charts alongside a searchable,
              citable public record. The schema is built so that comparative extension to other
              jurisdictions remains possible as the infrastructure matures.
            </p>
          </div>

          <div className="content-block">
            <h2>Time Period</h2>
            <p>
              Our records run from 2000 to the present. Beginning in 2000 captures the
              anti-globalisation protest wave immediately before September 11—the S11 blockade of
              the World Economic Forum in Melbourne is our earliest entry—which gives a baseline
              against which the post-9/11 expansion of counter-terrorism and public order powers
              can be measured. From that point the platform tracks how charging practice,
              sentencing and judicial interpretation have shifted as those powers were
              progressively extended and applied to political expression. Records are updated on
              an ongoing basis, and any record falling outside this period is labelled as such.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: 'What is the Justice Watch Network?',
      answer: 'The Justice Watch Network is a research initiative dedicated to tracking and analysing criminal prosecutions linked to political violence and civil activism in Australia and New Zealand-Aotearoa. We maintain a comprehensive database and produce research to promote transparency and understanding of how justice systems respond to politically-motivated cases.',
    },
    {
      question: 'What types of cases do you track?',
      answer: 'We track criminal prosecutions that have a nexus to political violence, terrorism, extremism, and civil activism. This includes terrorism-related charges, prosecutions arising from protest activities, cases involving extremist ideologies, and other incidents where political motivations were a factor in criminal proceedings.',
    },
    {
      question: 'What time period does your database cover?',
      answer: 'Our database covers cases from 2001 to the present. We chose this timeframe to capture the significant shifts in counter-terrorism policy and prosecution strategies that followed September 11, 2001, while documenting the evolving landscape of political activism and state responses in the region.',
    },
    {
      question: 'How do you collect your data?',
      answer: 'We collect data from primary sources including court records, official government documents, and verified news reports. All entries undergo verification processes, and we apply standardised coding protocols to ensure consistency across our database.',
    },
    {
      question: 'Is your data available for download?',
      answer: 'Yes, we are committed to open access. Our datasets will be available for download for research, journalism, and educational purposes. We ask that users review our data use guidelines and provide appropriate attribution when using our data.',
    },
    {
      question: 'How can I contribute to your research?',
      answer: 'We welcome contributions from researchers, journalists, and civil society organisations. You can contribute by: suggesting cases we may have missed, providing additional documentation for existing cases, collaborating on research projects, or supporting our work financially. Please contact us to discuss collaboration opportunities.',
    },
    {
      question: 'Do you take a political position on the cases you track?',
      answer: 'No. The Justice Watch Network maintains strict objectivity in our documentation. We apply consistent standards to cases across the political spectrum and do not advocate for or against any particular political position. Our goal is to provide accurate, factual information to enable informed analysis and discussion.',
    },
    {
      question: 'How often is your database updated?',
      answer: 'Our database is continuously updated as new cases emerge and existing cases progress through the legal system. We also conduct periodic reviews to verify existing entries and incorporate any new information that becomes available.',
    },
    {
      question: 'Can I request information about a specific case?',
      answer: 'Yes, you can contact us with inquiries about specific cases. While we may not be able to respond to all requests immediately, we do our best to assist researchers, journalists, and other legitimate inquiries.',
    },
    {
      question: 'How can I cite your data in my research?',
      answer: 'We provide citation guidelines for academic and journalistic use. Please refer to our data documentation for the recommended citation format, or contact us if you have specific questions about attribution.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-page">
      <section className="page-header">
        <div className="container">
          <h1>Frequently Asked Questions</h1>
          <p className="page-subtitle">Find answers to common questions about our work</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`faq-item ${openIndex === index ? 'faq-open' : ''}`}
              >
                <button
                  className="faq-question"
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={openIndex === index}
                >
                  <span>{faq.question}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="faq-icon"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="content-block faq-contact">
            <h2>Still have questions?</h2>
            <p>
              If you couldn't find the answer you were looking for, please don't hesitate
              to reach out. We're happy to help.
            </p>
            <a href="/contact" className="btn btn-primary">Contact Us</a>
          </div>
        </div>
      </section>
    </div>
  );
}

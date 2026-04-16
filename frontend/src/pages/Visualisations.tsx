import { useState } from 'react';
import { useSheetData } from '../hooks/useSheetData';
import CaseBubbles from '../components/CaseBubbles';
import CaseNetwork from '../components/CaseNetwork';

type Tab = 'bubbles' | 'network';

export default function Visualisations() {
  const { cases, source, error } = useSheetData();
  const [tab, setTab] = useState<Tab>('bubbles');

  return (
    <div>
      <div className="page-header">
        <h1>Visualisations</h1>
        <p className="page-subtitle">Interactive views across {cases.length} cases</p>
      </div>

      {/* Data source banner */}
      <div className={`viz-source-banner ${source === 'live' ? 'viz-source-live' : source === 'loading' ? 'viz-source-loading' : 'viz-source-fallback'}`}>
        {source === 'loading' && (
          <><span className="viz-source-spinner" /> Fetching live data from Google Sheets…</>
        )}
        {source === 'live' && (
          <><span className="viz-source-dot" /> Live — synced from Google Sheets · {cases.length} cases</>
        )}
        {source === 'fallback' && (
          <>
            <span className="viz-source-dot viz-source-dot-warn" />
            Showing seeded data
            {error && <span className="viz-source-err"> ({error})</span>}
            {' '}— make the spreadsheet publicly viewable to enable live sync
          </>
        )}
      </div>

      <section className="section">
        <div className="container">

          {/* Tab switcher */}
          <div className="viz-tabs">
            <button
              className={`viz-tab ${tab === 'bubbles' ? 'viz-tab-active' : ''}`}
              onClick={() => setTab('bubbles')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><circle cx="4.22" cy="4.22" r="1.5"/>
              </svg>
              Case Landscape
            </button>
            <button
              className={`viz-tab ${tab === 'network' ? 'viz-tab-active' : ''}`}
              onClick={() => setTab('network')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Case Network
            </button>
          </div>

          {/* Tab descriptions */}
          {tab === 'bubbles' ? (
            <p className="viz-desc">
              Each bubble is a case, grouped by jurisdiction (dashed ring) and coloured by decade.
              Bubble size is equal — as you add charges and outcomes to the spreadsheet,
              the relative sizes can reflect case complexity. Gold dot = tagged case.
            </p>
          ) : (
            <p className="viz-desc">
              Cases (coloured circles) are connected to shared legal entities and tag labels (pill nodes).
              The layout reveals clusters — e.g. NSW cases that all involve the Commissioner of Police
              form a dense hub. Drag nodes to explore; click any case to inspect it.
            </p>
          )}

          {tab === 'bubbles' ? (
            <CaseBubbles cases={cases} />
          ) : (
            <CaseNetwork cases={cases} key={cases.length /* re-mount when data changes */} />
          )}
        </div>
      </section>
    </div>
  );
}

import { useState, useMemo } from 'react';

interface Case {
  name: string;
  citation: string;
  link: string;
  charges: string;
  outcome: string;
  summary: string;
  tags: string[];
  year: number;
  jurisdiction: string;
}

const CASES: Case[] = [
  { name: 'Commissioner of Police v Rintoul', citation: '[2003] NSWSC 662', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2003/662.html', charges: '', outcome: '', summary: '', tags: ['police violence'], year: 2003, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Gabriel', citation: '[2004] NSWSC 31; (2004) 141 A Crim R 566', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2004/31.html', charges: '', outcome: '', summary: '', tags: ['racism'], year: 2004, jurisdiction: 'NSW' },
  { name: 'New South Wales Commissioner of Police v Bainbridge', citation: '[2007] NSWSC 1015; (2007) 175 A Crim R 226', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2007/1015.html', charges: '', outcome: '', summary: '', tags: [], year: 2007, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Langosch', citation: '[2012] NSWSC 499', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2012/499.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Ridgewell', citation: '[2014] NSWSC 1138', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2014/1138.html', charges: '', outcome: '', summary: '', tags: [], year: 2014, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Jackson', citation: '[2015] NSWSC 96', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2015/96.html', charges: '', outcome: '', summary: '', tags: [], year: 2015, jurisdiction: 'NSW' },
  { name: 'NSW Commissioner of Police v Folkes', citation: '[2015] NSWSC 1887', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2015/1887.html', charges: '', outcome: '', summary: '', tags: [], year: 2015, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Keep Sydney Open Ltd', citation: '[2017] NSWSC 5', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2017/5.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Marshall', citation: '[2017] NSWSC 1589', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2017/1589.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Da Costa-Reidel', citation: '[2019] NSWSC 198', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2019/198.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Bassi', citation: '[2020] NSWSC 710', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/710.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Bassi v Commissioner of Police', citation: '[2020] NSWCA 109', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2020/109.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police (NSW) v Supple', citation: '[2020] NSWSC 727', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/727.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Kumar', citation: '[2020] NSWSC 804', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/804.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Gray', citation: '[2020] NSWSC 867', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/867.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police (NSW) v Gibson', citation: '[2020] NSWSC 953', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/953.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Gibson v Commissioner of Police', citation: '[2020] NSWCA 160', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2020/160.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Thomson', citation: '[2020] NSWSC 1424', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/1424.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Holcombe', citation: '[2020] NSWSC 1428', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/1428.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { name: 'Kvelde v State of New South Wales', citation: '[2023] NSWSC 1560', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2023/1560.html', charges: '', outcome: '', summary: '', tags: [], year: 2023, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police v Coglin', citation: '[2024] NSWSC 1412', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2024/1412.html', charges: '', outcome: '', summary: '', tags: [], year: 2024, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police (NSW Police Force) v Joshua Lees', citation: '[2025] NSWSC 858', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2025/858.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { name: 'Lees v State of New South Wales', citation: '[2025] NSWSC 1209', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2025/1209.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { name: 'Commissioner of Police (NSW Police Force) v Naser', citation: '[2025] NSWCA 224', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2025/224.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { name: 'Magee v Delaney', citation: '[2012] VSC 407', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/vic/VSC/2012/407.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'VIC' },
  { name: 'Caripis v Victoria Police (Health and Privacy)', citation: '[2012] VCAT 1472', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/vic/VCAT/2012/1472.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'VIC' },
  { name: 'Muldoon v Melbourne City Council', citation: '[2011] FCA 1306', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2011/1306.html', charges: '', outcome: '', summary: '', tags: [], year: 2011, jurisdiction: 'Federal' },
  { name: 'Muldoon v Melbourne City Council', citation: '[2013] FCA 994; (2013) 217 FCR 450', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2013/994.html', charges: '', outcome: '', summary: '', tags: [], year: 2013, jurisdiction: 'Federal' },
  { name: 'Kerrison v Melbourne City Council', citation: '[2014] FCAFC 130', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCAFC/2014/130.html', charges: '', outcome: '', summary: '', tags: [], year: 2014, jurisdiction: 'Federal' },
  { name: 'Coleman v Power', citation: '[2004] HCA 39', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2004/39.html', charges: '', outcome: '', summary: '', tags: [], year: 2004, jurisdiction: 'High Court' },
  { name: 'Brown v Tasmania', citation: '[2017] HCA 43', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2017/43.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'High Court' },
  { name: 'Clubb v Edwards', citation: '[2019] HCA 11', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2019/11.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'High Court' },
  { name: 'Preston v Avery', citation: '[2019] HCA 11', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2019/11.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'High Court' },
  { name: 'Attorney-General for the State of Queensland v Sri & Ors', citation: '[2020] QSC 246', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/qld/QSC/2020/246.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'QLD' },
  { name: 'EH v Queensland Police Service; GS v Queensland Police Service', citation: '[2020] QDC 205', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/qld/QDC/2020/205.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'QLD' },
  { name: 'Browne v Assistant Commissioner of Police, North West Metro Region', citation: '[2026] FCA 15', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2026/15.html', charges: '', outcome: '', summary: '', tags: [], year: 2026, jurisdiction: 'Federal' },
];

const ALL_TAGS = Array.from(new Set(CASES.flatMap(c => c.tags))).sort();
const ALL_JURISDICTIONS = Array.from(new Set(CASES.map(c => c.jurisdiction))).sort();

type SortKey = 'year' | 'name' | 'jurisdiction';
type SortDir = 'asc' | 'desc';

export default function Database() {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeJurisdiction, setActiveJurisdiction] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('year');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let result = CASES;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.citation.toLowerCase().includes(q)
      );
    }
    if (activeTag) {
      result = result.filter(c => c.tags.includes(activeTag));
    }
    if (activeJurisdiction) {
      result = result.filter(c => c.jurisdiction === activeJurisdiction);
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'year') cmp = a.year - b.year;
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'jurisdiction') cmp = a.jurisdiction.localeCompare(b.jurisdiction);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [search, activeTag, activeJurisdiction, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="sort-icon sort-icon-neutral">↕</span>;
    return <span className="sort-icon sort-icon-active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="database-page">
      <div className="page-header">
        <h1>Case Database</h1>
        <p className="page-subtitle">
          Prosecutions linked to political violence and civil activism in Australia
        </p>
      </div>

      <section className="section">
        <div className="container">

          <div className="db-toolbar">
            <div className="db-search-wrapper">
              <svg className="db-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                className="db-search"
                type="text"
                placeholder="Search by case name or citation…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="db-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
              )}
            </div>
            <span className="db-count">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="db-filters">
            <div className="db-filter-group">
              <span className="db-filter-label">Jurisdiction</span>
              <div className="db-filter-pills">
                <button
                  className={`db-pill ${activeJurisdiction === null ? 'db-pill-active' : ''}`}
                  onClick={() => setActiveJurisdiction(null)}
                >
                  All
                </button>
                {ALL_JURISDICTIONS.map(j => (
                  <button
                    key={j}
                    className={`db-pill ${activeJurisdiction === j ? 'db-pill-active' : ''}`}
                    onClick={() => setActiveJurisdiction(activeJurisdiction === j ? null : j)}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
            {ALL_TAGS.length > 0 && (
              <div className="db-filter-group">
                <span className="db-filter-label">Tags</span>
                <div className="db-filter-pills">
                  <button
                    className={`db-pill ${activeTag === null ? 'db-pill-active' : ''}`}
                    onClick={() => setActiveTag(null)}
                  >
                    All
                  </button>
                  {ALL_TAGS.map(t => (
                    <button
                      key={t}
                      className={`db-pill ${activeTag === t ? 'db-pill-active' : ''}`}
                      onClick={() => setActiveTag(activeTag === t ? null : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="db-table-wrapper">
            <table className="db-table">
              <thead>
                <tr>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('name')}>
                    Case <SortIcon col="name" />
                  </th>
                  <th className="db-th">Citation</th>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('year')}>
                    Year <SortIcon col="year" />
                  </th>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('jurisdiction')}>
                    Jurisdiction <SortIcon col="jurisdiction" />
                  </th>
                  <th className="db-th">Charges</th>
                  <th className="db-th">Outcome</th>
                  <th className="db-th">Tags</th>
                  <th className="db-th">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="db-empty">No cases match your search.</td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr key={i} className="db-row">
                      <td className="db-td db-td-name">{c.name}</td>
                      <td className="db-td db-td-citation">{c.citation}</td>
                      <td className="db-td db-td-year">{c.year}</td>
                      <td className="db-td">
                        <span className={`db-jurisdiction db-jurisdiction-${c.jurisdiction.toLowerCase().replace(/\s+/g, '-')}`}>
                          {c.jurisdiction}
                        </span>
                      </td>
                      <td className="db-td db-td-muted">{c.charges || '—'}</td>
                      <td className="db-td db-td-muted">{c.outcome || '—'}</td>
                      <td className="db-td">
                        {c.tags.length > 0
                          ? c.tags.map(t => <span key={t} className="db-tag">{t}</span>)
                          : <span className="db-td-muted">—</span>
                        }
                      </td>
                      <td className="db-td">
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="db-link"
                          aria-label={`AustLII — ${c.name}`}
                        >
                          AustLII
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="db-note">
            Data sourced from AustLII. Charges, outcomes, and summaries are being progressively populated.
            To contribute or report an error, please <a href="#/contact">contact us</a>.
          </p>
        </div>
      </section>
    </div>
  );
}

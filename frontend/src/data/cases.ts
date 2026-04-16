// ─── Types ───────────────────────────────────────────────────────────────────

export interface Case {
  id: string;
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

// ─── Colour maps ─────────────────────────────────────────────────────────────

export const JURISDICTION_COLORS: Record<string, string> = {
  NSW:          '#1d3a5c',
  VIC:          '#3d6b35',
  QLD:          '#a86a10',
  WA:           '#5c3d1d',
  SA:           '#1d5c4a',
  ACT:          '#4a1d5c',
  NT:           '#5c1d2e',
  Federal:      '#3a3a8a',
  'High Court': '#7a2020',
  Unknown:      '#555555',
};

export const JURISDICTION_BG: Record<string, string> = {
  NSW:          'rgba(29,  58,  92,  0.12)',
  VIC:          'rgba(61, 107,  53,  0.12)',
  QLD:          'rgba(168,106,  16,  0.12)',
  WA:           'rgba(92,  61,  29,  0.12)',
  SA:           'rgba(29,  92,  74,  0.12)',
  ACT:          'rgba(74,  29,  92,  0.12)',
  NT:           'rgba(92,  29,  46,  0.12)',
  Federal:      'rgba(58,  58, 138,  0.12)',
  'High Court': 'rgba(122, 32,  32,  0.12)',
  Unknown:      'rgba(80,  80,  80,  0.12)',
};

export const DECADE_COLORS: Record<string, string> = {
  '2000s': '#1d3a5c',
  '2010s': '#3d6b35',
  '2020s': '#c49640',
};

// ─── Extraction helpers ───────────────────────────────────────────────────────

export function extractYear(citation: string): number {
  const m = citation.match(/\[(\d{4})\]/);
  return m ? parseInt(m[1], 10) : 0;
}

export function extractJurisdiction(citation: string): string {
  if (/NSWSC|NSWCA|NSWCCA|NSWDC|NSWLEC/i.test(citation)) return 'NSW';
  if (/VSC|VSCA|VCAT/i.test(citation))                    return 'VIC';
  if (/QSC|QCA|QDC|QLDC/i.test(citation))                 return 'QLD';
  if (/WASC|WASCA/i.test(citation))                        return 'WA';
  if (/SASC|SASCFC/i.test(citation))                       return 'SA';
  if (/ACTSC|ACTCA/i.test(citation))                       return 'ACT';
  if (/NTSC|NTCA/i.test(citation))                         return 'NT';
  if (/\bHCA\b/i.test(citation))                           return 'High Court';
  if (/\bFCA\b|FCAFC|FedCFamC|FCCA/i.test(citation))      return 'Federal';
  return 'Unknown';
}

export function getDecade(year: number): string {
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return '2020s';
}

function normalizeParty(name: string): string {
  const n = name.trim();
  if (/commissioner of police|assistant commissioner of police/i.test(n)) return 'Commissioner of Police';
  if (/state of new south wales/i.test(n))                 return 'State of NSW';
  if (/victoria police/i.test(n))                          return 'Victoria Police';
  if (/queensland police service/i.test(n))                return 'Queensland Police Service';
  if (/melbourne city council/i.test(n))                   return 'Melbourne City Council';
  if (/attorney.general.*queensland/i.test(n))             return 'Attorney-General (QLD)';
  return n;
}

export function extractParties(caseName: string): string[] {
  return caseName.split(/\s+v\s+/i).map(p => normalizeParty(p));
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
// Handles quoted fields, embedded newlines, escaped quotes

function parseCSVRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"' && raw[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"')                    { inQuotes = false; }
      else                                    { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else                  { field += ch; }
    }
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

export function parseSheetCSV(csv: string): Case[] {
  const rows = parseCSVRows(csv);
  if (rows.length < 2) return [];       // no data rows
  const data = rows.slice(1);           // skip header
  const cases: Case[] = [];
  for (let i = 0; i < data.length; i++) {
    const cols = data[i];
    const name = cols[0]?.trim() ?? '';
    if (!name) continue;
    const citation    = cols[1]?.trim() ?? '';
    const link        = cols[2]?.trim() ?? '';
    const charges     = cols[3]?.trim() ?? '';
    const outcome     = cols[4]?.trim() ?? '';
    const summary     = cols[5]?.trim() ?? '';
    const tagsRaw     = cols[6]?.trim() ?? '';
    const tags        = tagsRaw ? tagsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];
    const year        = extractYear(citation);
    const jurisdiction = extractJurisdiction(citation);
    cases.push({ id: `row-${i}`, name, citation, link, charges, outcome, summary, tags, year, jurisdiction });
  }
  return cases;
}

// ─── Seeded fallback data ────────────────────────────────────────────────────
// Used while the live fetch is in progress or if it fails.

export const FALLBACK_CASES: Case[] = [
  { id: 'c0',  name: 'Commissioner of Police v Rintoul', citation: '[2003] NSWSC 662', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2003/662.html', charges: '', outcome: '', summary: '', tags: ['police violence'], year: 2003, jurisdiction: 'NSW' },
  { id: 'c1',  name: 'Commissioner of Police v Gabriel', citation: '[2004] NSWSC 31; (2004) 141 A Crim R 566', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2004/31.html', charges: '', outcome: '', summary: '', tags: ['racism'], year: 2004, jurisdiction: 'NSW' },
  { id: 'c2',  name: 'New South Wales Commissioner of Police v Bainbridge', citation: '[2007] NSWSC 1015; (2007) 175 A Crim R 226', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2007/1015.html', charges: '', outcome: '', summary: '', tags: [], year: 2007, jurisdiction: 'NSW' },
  { id: 'c3',  name: 'Commissioner of Police v Langosch', citation: '[2012] NSWSC 499', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2012/499.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'NSW' },
  { id: 'c4',  name: 'Commissioner of Police v Ridgewell', citation: '[2014] NSWSC 1138', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2014/1138.html', charges: '', outcome: '', summary: '', tags: [], year: 2014, jurisdiction: 'NSW' },
  { id: 'c5',  name: 'Commissioner of Police v Jackson', citation: '[2015] NSWSC 96', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2015/96.html', charges: '', outcome: '', summary: '', tags: [], year: 2015, jurisdiction: 'NSW' },
  { id: 'c6',  name: 'NSW Commissioner of Police v Folkes', citation: '[2015] NSWSC 1887', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2015/1887.html', charges: '', outcome: '', summary: '', tags: [], year: 2015, jurisdiction: 'NSW' },
  { id: 'c7',  name: 'Commissioner of Police v Keep Sydney Open Ltd', citation: '[2017] NSWSC 5', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2017/5.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'NSW' },
  { id: 'c8',  name: 'Commissioner of Police v Marshall', citation: '[2017] NSWSC 1589', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2017/1589.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'NSW' },
  { id: 'c9',  name: 'Commissioner of Police v Da Costa-Reidel', citation: '[2019] NSWSC 198', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2019/198.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'NSW' },
  { id: 'c10', name: 'Commissioner of Police v Bassi', citation: '[2020] NSWSC 710', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/710.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c11', name: 'Bassi v Commissioner of Police', citation: '[2020] NSWCA 109', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2020/109.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c12', name: 'Commissioner of Police (NSW) v Supple', citation: '[2020] NSWSC 727', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/727.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c13', name: 'Commissioner of Police v Kumar', citation: '[2020] NSWSC 804', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/804.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c14', name: 'Commissioner of Police v Gray', citation: '[2020] NSWSC 867', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/867.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c15', name: 'Commissioner of Police (NSW) v Gibson', citation: '[2020] NSWSC 953', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/953.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c16', name: 'Gibson v Commissioner of Police', citation: '[2020] NSWCA 160', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2020/160.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c17', name: 'Commissioner of Police v Thomson', citation: '[2020] NSWSC 1424', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/1424.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c18', name: 'Commissioner of Police v Holcombe', citation: '[2020] NSWSC 1428', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2020/1428.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'NSW' },
  { id: 'c19', name: 'Kvelde v State of New South Wales', citation: '[2023] NSWSC 1560', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2023/1560.html', charges: '', outcome: '', summary: '', tags: [], year: 2023, jurisdiction: 'NSW' },
  { id: 'c20', name: 'Commissioner of Police v Coglin', citation: '[2024] NSWSC 1412', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2024/1412.html', charges: '', outcome: '', summary: '', tags: [], year: 2024, jurisdiction: 'NSW' },
  { id: 'c21', name: 'Commissioner of Police (NSW Police Force) v Joshua Lees', citation: '[2025] NSWSC 858', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2025/858.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { id: 'c22', name: 'Lees v State of New South Wales', citation: '[2025] NSWSC 1209', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWSC/2025/1209.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { id: 'c23', name: 'Commissioner of Police (NSW Police Force) v Naser', citation: '[2025] NSWCA 224', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/nsw/NSWCA/2025/224.html', charges: '', outcome: '', summary: '', tags: [], year: 2025, jurisdiction: 'NSW' },
  { id: 'c24', name: 'Magee v Delaney', citation: '[2012] VSC 407', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/vic/VSC/2012/407.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'VIC' },
  { id: 'c25', name: 'Caripis v Victoria Police (Health and Privacy)', citation: '[2012] VCAT 1472', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/vic/VCAT/2012/1472.html', charges: '', outcome: '', summary: '', tags: [], year: 2012, jurisdiction: 'VIC' },
  { id: 'c26', name: 'Muldoon v Melbourne City Council', citation: '[2011] FCA 1306', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2011/1306.html', charges: '', outcome: '', summary: '', tags: [], year: 2011, jurisdiction: 'Federal' },
  { id: 'c27', name: 'Muldoon v Melbourne City Council', citation: '[2013] FCA 994; (2013) 217 FCR 450', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2013/994.html', charges: '', outcome: '', summary: '', tags: [], year: 2013, jurisdiction: 'Federal' },
  { id: 'c28', name: 'Kerrison v Melbourne City Council', citation: '[2014] FCAFC 130', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCAFC/2014/130.html', charges: '', outcome: '', summary: '', tags: [], year: 2014, jurisdiction: 'Federal' },
  { id: 'c29', name: 'Coleman v Power', citation: '[2004] HCA 39', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2004/39.html', charges: '', outcome: '', summary: '', tags: [], year: 2004, jurisdiction: 'High Court' },
  { id: 'c30', name: 'Brown v Tasmania', citation: '[2017] HCA 43', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2017/43.html', charges: '', outcome: '', summary: '', tags: [], year: 2017, jurisdiction: 'High Court' },
  { id: 'c31', name: 'Clubb v Edwards', citation: '[2019] HCA 11', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2019/11.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'High Court' },
  { id: 'c32', name: 'Preston v Avery', citation: '[2019] HCA 11', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2019/11.html', charges: '', outcome: '', summary: '', tags: [], year: 2019, jurisdiction: 'High Court' },
  { id: 'c33', name: 'Attorney-General for the State of Queensland v Sri & Ors', citation: '[2020] QSC 246', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/qld/QSC/2020/246.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'QLD' },
  { id: 'c34', name: 'EH v Queensland Police Service; GS v Queensland Police Service', citation: '[2020] QDC 205', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/qld/QDC/2020/205.html', charges: '', outcome: '', summary: '', tags: [], year: 2020, jurisdiction: 'QLD' },
  { id: 'c35', name: 'Browne v Assistant Commissioner of Police, North West Metro Region', citation: '[2026] FCA 15', link: 'https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2026/15.html', charges: '', outcome: '', summary: '', tags: [], year: 2026, jurisdiction: 'Federal' },
];

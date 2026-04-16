import { useState, useEffect } from 'react';
import { FALLBACK_CASES, parseSheetCSV, type Case } from '../data/cases';

// Google Sheets CSV export — works for any sheet shared as "anyone with the link can view".
// Change SHEET_ID to point to a different spreadsheet.
const SHEET_ID = '19QdB78ap_eWTpmddimBWAiWBNRKs4B89AzVFyuLb2fc';
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

export type DataSource = 'loading' | 'live' | 'fallback';

export interface SheetData {
  cases: Case[];
  source: DataSource;
  error: string | null;
}

export function useSheetData(): SheetData {
  const [cases,  setCases]  = useState<Case[]>(FALLBACK_CASES);
  const [source, setSource] = useState<DataSource>('loading');
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(CSV_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(csv => {
        if (cancelled) return;
        const parsed = parseSheetCSV(csv);
        if (parsed.length > 0) {
          setCases(parsed);
          setSource('live');
        } else {
          setSource('fallback');
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setSource('fallback');
      });

    return () => { cancelled = true; };
  }, []);

  return { cases, source, error };
}

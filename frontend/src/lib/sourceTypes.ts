// Single source of truth for how "source" records (case commentary sources in
// CaseStudies.tsx, and incident sources in Analytics.tsx's network map) are
// classed and coloured, so the same evidentiary type always reads the same
// colour everywhere on the site.

export type SourceTypeLabel =
  | 'News media'
  | 'Government or official'
  | 'Legal or NGO commentary'
  | 'Academic commentary'
  | 'The Conversation'
  | 'Other';

export const SOURCE_TYPE_COLOURS: Record<SourceTypeLabel, string> = {
  'News media': '#1d4ed8',
  'Government or official': '#0f766e',
  'Legal or NGO commentary': '#7c3aed',
  'Academic commentary': '#be185d',
  'The Conversation': '#c2410c',
  Other: '#6b7280',
};

const CANONICAL = new Set<string>(Object.keys(SOURCE_TYPE_COLOURS));

/**
 * Case-sourcing-round data (case_sources.json) already uses the canonical
 * labels above. Incident-tracker sources use a different, more granular
 * vocabulary (e.g. "Civil Society / Legal", "Government / Police") — this
 * folds any raw type string onto the same canonical set.
 */
export function normalizeSourceType(raw: string): SourceTypeLabel {
  if (CANONICAL.has(raw)) return raw as SourceTypeLabel;
  const primary = raw.split('/')[0].trim();
  switch (primary) {
    case 'Academic':
    case 'Think Tank':
      return 'Academic commentary';
    case 'Government':
    case 'Oversight':
    case 'Political':
      return 'Government or official';
    case 'Civil Society':
    case 'Activist':
    case 'Court':
    case 'Legal':
    case 'International':
      return 'Legal or NGO commentary';
    case 'Media':
      return 'News media';
    default:
      return 'Other';
  }
}

export function sourceTypeColour(raw: string): string {
  return SOURCE_TYPE_COLOURS[normalizeSourceType(raw)];
}

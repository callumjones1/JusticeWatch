import apiClient from './client';

export interface EventFlags {
  arrest: boolean;
  court: boolean;
  force: boolean;
  legal: boolean;
  policing: boolean;
}

export interface EventSummary {
  event_id: string;
  display_title: string;
  title_core: string | null;
  status: string | null;
  date_start: string | null;
  date_end: string | null;
  date_precision: string | null;
  date_reported_text: string | null;
  primary_state: string | null;
  primary_city: string | null;
  article_count: number;
  quote_count: number;
  evidence_count: number;
  issue_categories: string[];
  flags: EventFlags;
}

export interface LocationOut {
  venue: string | null;
  city: string | null;
  state_or_territory: string | null;
  country: string | null;
  precision: string | null;
  article_ids: string[];
}

export interface NumberEstimate {
  value_text: string;
  article_ids: string[];
}

export interface NumberGroup {
  items: NumberEstimate[];
  total_count: number;
}

export interface NumbersOut {
  crowd: NumberGroup;
  arrest: NumberGroup;
  charged: NumberGroup;
  injury: NumberGroup;
}

export interface Participant {
  name_or_description: string;
  roles: string[];
  organisations: string[];
  quoted: boolean | null;
  article_ids: string[];
}

export interface ParticipantGroup {
  items: Participant[];
  total_count: number;
}

export interface ParticipantsOut {
  protest_groups: ParticipantGroup;
  protest_spokespeople: ParticipantGroup;
  authority_orgs: ParticipantGroup;
  authority_spokespeople: ParticipantGroup;
}

export interface ActivityOut {
  description: string;
  article_ids: string[];
}

export interface EvidenceUnit {
  document_id: string | null;
  text: string | null;
  fields: string[];
}

export interface QuoteOut {
  document_id: string | null;
  speaker_name: string | null;
  speaker_organisation: string | null;
  speaker_type: string | null;
  stance_toward_protest: string | null;
  text: string | null;
  word_count: number | null;
}

export interface LinkedArticle {
  document_id: string;
  headline: string | null;
  byline: string | null;
  publication: string | null;
  publication_date: string | null;
  section: string | null;
  page: string | null;
  word_count: number | null;
  source_year: number | null;
  framing: string | null;
  framing_reason: string | null;
  relevance_category: string | null;
  relevance_status: string | null;
  relevance_reason: string | null;
}

export interface EventDetail extends EventSummary {
  cause_summary: string | null;
  cause_alt_summaries: string[];
  protesting_for: string[];
  protesting_against: string[];
  publications: string[];
  locations: LocationOut[];
  numbers: NumbersOut;
  participants: ParticipantsOut;
  policing_activities: ActivityOut[];
  legal_outcomes: ActivityOut[];
  quotes: QuoteOut[];
  quotes_total_count: number;
  evidence: EvidenceUnit[];
  evidence_total_count: number;
  linked_articles: LinkedArticle[];
  linked_articles_total_count: number;
}

export interface PaginatedEvents {
  items: EventSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CategoryFacet {
  key: string;
  label: string;
  event_count: number;
}

export interface Facets {
  states: string[];
  categories: CategoryFacet[];
  statuses: string[];
  year_min: number | null;
  year_max: number | null;
}

export type SortBy = 'date' | 'title' | 'location' | 'status' | 'articles' | 'quotes';
export type SortDir = 'asc' | 'desc';

export interface ListEventsParams {
  year_from?: number;
  year_to?: number;
  state?: string;
  category?: string;
  status?: string;
  flag_arrest?: boolean;
  flag_court?: boolean;
  flag_force?: boolean;
  flag_legal?: boolean;
  flag_policing?: boolean;
  min_article_count?: number;
  q?: string;
  sort_by?: SortBy;
  sort_dir?: SortDir;
  page?: number;
  page_size?: number;
}

function toQueryParams(params: ListEventsParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = String(value);
  }
  return out;
}

export function listEvents(params: ListEventsParams, signal?: AbortSignal): Promise<PaginatedEvents> {
  return apiClient.get<PaginatedEvents>('/events', { params: toQueryParams(params), signal });
}

export function getEvent(id: string, signal?: AbortSignal): Promise<EventDetail> {
  return apiClient.get<EventDetail>(`/events/${encodeURIComponent(id)}`, { signal });
}

export function getFacets(signal?: AbortSignal): Promise<Facets> {
  return apiClient.get<Facets>('/events/facets', { signal });
}

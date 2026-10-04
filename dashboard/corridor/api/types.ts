export type Product = "crude_oil" | "sour_gas" | "sweet_gas";
export type Consequence = "high" | "medium" | "low";
export type Level = 1 | 2 | 3 | 4 | 5;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RankingRow {
  id: string;
  rank: number;
  corridor: string;
  product: Product;
  incidents: number;
  consequence: Consequence;
  score: number;
  centroid: LatLng;
}

export interface Ranking {
  generated_at: string;
  total_incidents: number;
  unplaced: number;
  total_corridors: number;
  unscored: number;
  rows: RankingRow[];
}

export interface IncidentRankRow {
  id: string;
  rank: number;
  incident_id: string;
  reported: string;
  release_type: string;
  corridor: string | null;
  corridor_id: string | null;
  product: Product | null;
  likelihood: Level;
  consequence: Level;
  score: number;
  likelihood_note: string;
  consequence_note: string;
  product_note: string;
}

export interface IncidentRanking {
  scored: number;
  rows: IncidentRankRow[];
}

export interface RecentIncident {
  id: string;
  date: string;
  type: string;
  level: Level;
  volume_m3: number | null;
}

export interface FactorLine {
  label: string;
  detail: string;
}

export interface CorridorIncident {
  id: string;
  date: string;
  type: string;
  risk: number | null;
  likelihood: FactorLine[];
  consequence: FactorLine[];
  product: string;
}

export interface CorridorDetail extends RankingRow {
  summary: string;
  peak: number;
  by_level: Record<"1" | "2" | "3" | "4" | "5", number>;
  recent: RecentIncident[];
  items: CorridorIncident[];
}

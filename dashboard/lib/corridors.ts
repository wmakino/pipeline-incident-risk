import type { IncidentCollection, IncidentProperties } from "./incidents.ts";
import { riskBreakdown, riskFactors } from "./riskBreakdown.ts";
import type {
  Consequence,
  CorridorDetail,
  IncidentRanking,
  Level,
  Product,
  Ranking,
  RankingRow,
} from "../corridor/api/types.ts";

const AS_OF = "2026-09-25T00:00:00Z";

interface Member {
  item: IncidentProperties;
  lat: number;
  lng: number;
  place: string;
}

function placeName(raw: string): string | null {
  const name = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/,?\s*(alberta|ab)\.?$/i, "")
    .trim();
  if (!name || /^not specified$/i.test(name)) return null;
  if (name.length > 48 || /\bkm\b/i.test(name)) return null;
  return name;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function productOf(substance: string): Product | null {
  const text = substance.toLowerCase();
  if (!text || text === "not applicable") return null;
  if (text.includes("sour")) return "sour_gas";
  if (/crude|oil|diesel|condensate/.test(text)) return "crude_oil";
  return "sweet_gas";
}

function bucket(level: number | null): Consequence {
  if ((level ?? 0) >= 4) return "high";
  if ((level ?? 0) >= 2) return "medium";
  return "low";
}

function albertaMembers(collection: IncidentCollection): { members: Member[]; dropped: number } {
  const members: Member[] = [];
  let dropped = 0;
  for (const feature of collection.features) {
    const item = feature.properties;
    if (item.province !== "Alberta") continue;
    const place = placeName(item.nearest_populated_centre);
    if (!place) {
      dropped += 1;
      continue;
    }
    const [lng, lat] = feature.geometry.coordinates;
    members.push({ item, lat, lng, place });
  }
  return { members, dropped };
}

interface Group {
  id: string;
  corridor: string;
  product: Product;
  incidents: number;
  consequence: Consequence;
  centroid: { lat: number; lng: number };
  members: Member[];
}

function groupsOf(members: Member[]): Group[] {
  const grouped = new Map<string, Member[]>();
  for (const member of members) {
    const id = slug(member.place);
    const list = grouped.get(id) ?? [];
    list.push(member);
    grouped.set(id, list);
  }
  return [...grouped.entries()].map(([id, group]) => {
    const counts = new Map<Product, number>();
    for (const member of group) {
      const product = productOf(member.item.substance);
      if (product) counts.set(product, (counts.get(product) ?? 0) + 1);
    }
    const product = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "sweet_gas";
    const worst = group.reduce((max, member) => Math.max(max, member.item.consequence ?? 0), 0);
    return {
      id,
      corridor: group[0].place,
      product,
      incidents: group.length,
      consequence: bucket(worst),
      centroid: {
        lat: group.reduce((sum, member) => sum + member.lat, 0) / group.length,
        lng: group.reduce((sum, member) => sum + member.lng, 0) / group.length,
      },
      members: group,
    };
  });
}

function townRisk(group: Group): number {
  return group.members.reduce((sum, member) => sum + (member.item.risk ?? 0), 0);
}

function scoredRows(groups: Group[]): RankingRow[] {
  return groups
    .map((group) => ({
      id: group.id,
      corridor: group.corridor,
      product: group.product,
      incidents: group.incidents,
      consequence: group.consequence,
      score: townRisk(group),
      centroid: group.centroid,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.incidents - a.incidents || a.corridor.localeCompare(b.corridor))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function rankIncidents(collection: IncidentCollection, limit = 15): IncidentRanking {
  const candidates = [];
  for (const feature of collection.features) {
    const item = feature.properties;
    if (item.province !== "Alberta" || item.risk == null || item.consequence == null) continue;
    const place = placeName(item.nearest_populated_centre);
    const breakdown = riskBreakdown(item);
    candidates.push({
      id: item.incident_id,
      incident_id: item.incident_id,
      reported: item.reported,
      release_type: item.release_type || "Incident",
      corridor: place,
      corridor_id: place ? slug(place) : null,
      product: productOf(item.substance),
      likelihood: item.likelihood,
      consequence: item.consequence,
      score: item.risk,
      likelihood_note: breakdown.likelihoodNote,
      consequence_note: breakdown.consequenceNote,
      product_note: breakdown.productNote,
      rank: 0,
    });
  }
  const rows = candidates
    .sort((a, b) => b.score - a.score || b.likelihood - a.likelihood || b.reported.localeCompare(a.reported) || a.incident_id.localeCompare(b.incident_id))
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return { scored: candidates.length, rows };
}

export function rankCorridors(collection: IncidentCollection, limit = 15): Ranking {
  const { members, dropped } = albertaMembers(collection);
  const rows = scoredRows(groupsOf(members));
  return {
    generated_at: AS_OF,
    total_incidents: members.length,
    unplaced: dropped,
    total_corridors: rows.length,
    unscored: members.filter((member) => member.item.risk == null).length,
    rows: rows.slice(0, limit),
  };
}

export function corridorDetail(collection: IncidentCollection, id: string): CorridorDetail | null {
  const { members } = albertaMembers(collection);
  const groups = groupsOf(members);
  const rows = scoredRows(groups);
  const row = rows.find((item) => item.id === id);
  const group = groups.find((item) => item.id === id);
  if (!row || !group) return null;
  const byLevel = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const member of group.members) {
    byLevel[String(member.item.likelihood) as keyof typeof byLevel] += 1;
  }
  const peak = group.members.reduce((max, member) => Math.max(max, member.item.risk ?? 0), 0);
  const recent = [...group.members]
    .sort((a, b) => b.item.reported.localeCompare(a.item.reported))
    .slice(0, 3)
    .map((member) => ({
      id: member.item.incident_id,
      date: member.item.reported,
      type: member.item.release_type || "Incident",
      level: member.item.likelihood as Level,
      volume_m3: member.item.volume_m3,
    }));
  const items = [...group.members]
    .map((member) => {
      const report = riskFactors(member.item);
      return {
        id: member.item.incident_id,
        date: member.item.reported,
        type: member.item.release_type || "Incident",
        risk: member.item.risk,
        likelihood: report.likelihood,
        consequence: report.consequence,
        product: report.product,
      };
    })
    .sort((a, b) => (b.risk ?? -1) - (a.risk ?? -1) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return {
    ...row,
    peak,
    summary: `${row.corridor} has ${row.incidents} Alberta incidents. Each scored incident is likelihood times consequence, the same number as on the map. The highest is ${peak}. The town total is ${row.score}, the sum of those risks.`,
    by_level: byLevel,
    recent,
    items,
  };
}

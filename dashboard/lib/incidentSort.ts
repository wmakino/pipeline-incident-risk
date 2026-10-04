export type SortKey =
  | "incident_number"
  | "company"
  | "province"
  | "reported_date"
  | "likelihood"
  | "consequence"
  | "risk"
  | "criticality_score"
  | "groundwater_impact_score";

export type SortDirection = "asc" | "desc";

export type IncidentSort = {
  key: SortKey;
  direction: SortDirection;
};

export type SortableIncident = {
  incident_number: string;
  company: string;
  province: string;
  reported_date: string;
  likelihood: number | null;
  consequence: number | null;
  risk: number | null;
  criticality_score: number | null;
  groundwater_impact_score: number | null;
};

const NUMBER_KEYS = [
  "likelihood",
  "consequence",
  "risk",
  "criticality_score",
  "groundwater_impact_score",
] as const;

type NumberKey = (typeof NUMBER_KEYS)[number];

function isNumberKey(key: SortKey): key is NumberKey {
  return (NUMBER_KEYS as readonly SortKey[]).includes(key);
}

function reportedTime(value: string): number | null {
  const [month, day, year] = value.split("/").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const time = Date.UTC(year, month - 1, day);
  return Number.isNaN(time) ? null : time;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en-CA", { sensitivity: "base" });
}

function compareMissingLast(left: number | null, right: number | null, direction: SortDirection): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function sortIncidentRows<T extends SortableIncident>(rows: T[], sort: IncidentSort): T[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows.toSorted((left, right) => {
    let compared = 0;
    if (isNumberKey(sort.key)) {
      compared = compareMissingLast(left[sort.key], right[sort.key], sort.direction);
    } else if (sort.key === "reported_date") {
      compared = compareMissingLast(reportedTime(left.reported_date), reportedTime(right.reported_date), sort.direction);
    } else {
      compared = compareText(left[sort.key], right[sort.key]) * direction;
    }
    if (compared !== 0) return compared;
    return compareText(left.incident_number, right.incident_number);
  });
}

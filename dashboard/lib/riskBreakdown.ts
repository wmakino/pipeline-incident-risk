import type { IncidentProperties } from "./incidents.ts";

const AS_OF_MS = Date.UTC(2026, 8, 25);

export type RiskBreakdown = {
  likelihoodNote: string;
  consequenceNote: string;
  productNote: string;
};

export type FactorLine = {
  label: string;
  detail: string;
};

export type RiskFactorReport = {
  likelihood: FactorLine[];
  consequence: FactorLine[];
  product: string;
};

function yearsBefore(reported: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(reported);
  if (!match) return 0;
  const reportedMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const days = (AS_OF_MS - reportedMs) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return 0;
  return days / 365.25;
}

function ageBand(years: number): { base: number; label: string } {
  if (years < 1) return { base: 4, label: "under 1 year" };
  if (years < 3) return { base: 3, label: "1 year to under 3" };
  return { base: 1, label: "3 years or older" };
}

function likelihoodLevel(reported: string, n: number, neverInspected: IncidentProperties["never_inspected"]): {
  level: number;
  note: string;
} {
  const { base, label } = ageBand(yearsBefore(reported));
  const steps: string[] = [];
  let level = base;
  if (n >= 1) {
    steps.push("neighbor");
    level += 1;
  }
  if (neverInspected === "Yes") {
    steps.push("never inspected");
    level += 1;
  }
  const capped = level > 5;
  level = Math.min(level, 5);
  if (steps.length === 0) return { level, note: label };
  const sum = `${label} + ${steps.join(" + ")}`;
  return { level, note: capped ? `${sum}, capped at 5` : sum };
}

function volumeBase(releaseType: string, volume: number | null): number | null {
  if (volume == null || !Number.isFinite(volume) || volume <= 0) return null;
  const kind = releaseType.trim();
  const bands =
    kind === "Gas"
      ? { middle: 1_000, high: 100_000 }
      : kind === "Liquid" || kind === "Miscellaneous"
        ? { middle: 10, high: 100 }
        : null;
  if (!bands) return null;
  if (volume >= bands.high) return 4;
  if (volume >= bands.middle) return 3;
  return 1;
}

function interruptionAdd(duration: string): 0 | 1 | 2 {
  const text = duration.trim();
  if (text === "Short-term interruption") return 1;
  if (text === "Long-term interruption") return 2;
  return 0;
}

function equation(bits: string[], level: number, uncapped: number): string {
  const body = bits.join(" + ");
  if (uncapped > 5) return `${body}, capped at 5`;
  if (bits.length === 1 && body.endsWith(String(level))) return body;
  return `${body} = ${level}`;
}

function releaseLevel(item: IncidentProperties): { level: number | null; note: string } {
  const volume = volumeBase(item.release_type, item.volume_m3);
  const base = item.boscem_level ?? volume;
  const added = interruptionAdd(item.interruption);
  const elevated = item.elevated_density;
  const category = item.category_step;

  if (base == null) {
    if (added === 0) {
      if (!elevated) return { level: null, note: "" };
      const level = category ? 2 : 1;
      const bits = category ? ["occupancy", "natural force"] : ["occupancy"];
      return { level, note: equation(bits, level, level) };
    }
    const bits = [added === 1 ? "short interruption" : "long interruption"];
    let uncapped = added === 1 ? 2 : 4;
    if (elevated) {
      uncapped += 1;
      bits.push("density");
    }
    if (category) {
      uncapped += 1;
      bits.push("natural force");
    }
    return { level: Math.min(uncapped, 5), note: equation(bits, Math.min(uncapped, 5), uncapped) };
  }

  const bits = [item.boscem_level != null ? `BOSCEM ${item.boscem_level}` : `volume ${volume}`];
  let uncapped = base + added;
  if (added === 1) bits.push("short interruption");
  if (added === 2) bits.push("long interruption");
  if (elevated) {
    uncapped += 1;
    bits.push("density");
  }
  if (category) {
    uncapped += 1;
    bits.push("natural force");
  }
  return { level: Math.min(uncapped, 5), note: equation(bits, Math.min(uncapped, 5), uncapped) };
}

function modelScore(score: number | null | undefined, status: string | undefined): number | null {
  if (status !== "scored" || typeof score !== "number" || !Number.isInteger(score)) return null;
  if (score < 1 || score > 5) return null;
  return score;
}

function foldedConsequence(item: IncidentProperties): { level: number | null; note: string } {
  const release = releaseLevel(item);
  const criticality = modelScore(item.criticality_score, item.criticality_status);
  const groundwater = modelScore(item.groundwater_impact_score, item.groundwater_status);
  const models = [
    criticality == null ? null : `criticality ${criticality}`,
    groundwater == null ? null : `groundwater ${groundwater}`,
  ].filter((part): part is string => part != null);

  if (models.length === 0) return release;

  const scores = [release.level, criticality, groundwater].filter((score): score is number => score != null);
  const rounded = Math.floor(scores.reduce((sum, score) => sum + score, 0) / scores.length + 0.5);
  const held = release.level != null && rounded < release.level;
  const level = Math.min(5, Math.max(1, held && release.level != null ? release.level : rounded));
  if (release.level == null) {
    const body = models.join(" and ");
    const note = models.length === 1 && body.endsWith(String(level)) ? body : `${body} = ${level}`;
    return { level, note };
  }
  const average = `averaged with ${models.join(" and ")}`;
  const clause = held ? `${average}, held at ${release.level}` : `${average} = ${level}`;
  const note = release.note ? `${release.note}; ${clause}` : clause;
  return { level, note };
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function money(cost: number): string {
  return cost.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

function modelDetail(score: number | null | undefined, status: string | undefined): string {
  const level = modelScore(score, status);
  if (level != null) return `${level}, included`;
  if (status && status !== "scored") return `${status.replace(/_/g, " ")}, left out`;
  return "Not scored, left out";
}

export function riskFactors(item: IncidentProperties): RiskFactorReport {
  const years = yearsBefore(item.reported);
  const { base, label } = ageBand(years);
  const neighbor = item.n >= 1;
  const never = item.never_inspected === "Yes";
  const likelihoodRaw = base + (neighbor ? 1 : 0) + (never ? 1 : 0);
  const likelihoodLevelValue = Math.min(likelihoodRaw, 5);
  const volume = volumeBase(item.release_type, item.volume_m3);
  const hasBase = item.boscem_level != null || volume != null;
  const added = interruptionAdd(item.interruption);
  const release = releaseLevel(item);
  const criticality = modelScore(item.criticality_score, item.criticality_status);
  const groundwater = modelScore(item.groundwater_impact_score, item.groundwater_status);
  const folded = foldedConsequence(item);

  const volumeDetail =
    item.volume_m3 == null || volume == null
      ? "Not reported"
      : `${item.volume_m3.toLocaleString("en-CA", { maximumFractionDigits: 3 })} m³ ${item.release_type}, level ${volume}`;
  const boscemDetail =
    item.boscem_level == null
      ? "Not used"
      : `Level ${item.boscem_level}${item.boscem_cost == null ? "" : `, ${money(item.boscem_cost)}`}${
          item.land_use ? `, ${item.land_use}` : ""
        }, used as the base`;
  const interruptionDetail =
    added === 0
      ? "None, adds nothing"
      : hasBase
        ? added === 1
          ? "Short-term, adds 1"
          : "Long-term, adds 2"
        : added === 1
          ? "Short-term, base 2"
          : "Long-term, base 4";
  const occupancyIsBase = !hasBase && added === 0 && item.elevated_density;
  const densityDetail = !item.elevated_density
    ? "Not elevated, adds nothing"
    : occupancyIsBase
      ? item.category_step
        ? "Elevated, base 2 with natural force"
        : "Elevated, base 1"
      : `Elevated, adds 1${item.population_density ? `. ${item.population_density}` : ""}`;
  const forceDetail = !item.category_step
    ? "No, adds nothing"
    : occupancyIsBase
      ? "Yes, included in the occupancy base"
      : "Yes, adds 1";

  const modelParts = [
    release.level == null ? null : `release ${release.level}`,
    criticality == null ? null : `criticality ${criticality}`,
    groundwater == null ? null : `groundwater ${groundwater}`,
  ].filter((part): part is string => part != null);
  const scores = [release.level, criticality, groundwater].filter((score): score is number => score != null);
  const rounded =
    scores.length === 0 ? null : Math.floor(scores.reduce((sum, score) => sum + score, 0) / scores.length + 0.5);
  const consequenceDetail = (() => {
    if (item.consequence == null) return "Not scored";
    if (folded.level !== item.consequence || rounded == null) return String(item.consequence);
    if (criticality == null && groundwater == null) return release.level == null ? String(item.consequence) : `Release ${release.level}`;
    if (release.level != null && rounded < release.level) {
      return `Average is ${rounded}, held at the release ${release.level}`;
    }
    return `Average of ${joinList(modelParts)} is ${item.consequence}`;
  })();

  const likelihoodDetail =
    likelihoodLevelValue === item.likelihood
      ? likelihoodRaw > 5
        ? `${likelihoodRaw}, capped at 5`
        : String(likelihoodLevelValue)
      : `Stored ${item.likelihood}`;

  return {
    likelihood: [
      { label: "Reported age", detail: `${label}, base ${base}` },
      { label: "Neighbor", detail: neighbor ? `Yes, ${item.n} within 100 m, adds 1` : "No, adds nothing" },
      { label: "Never inspected", detail: never ? "Yes, adds 1" : "No, adds nothing" },
      { label: "Likelihood", detail: likelihoodDetail },
    ],
    consequence: [
      { label: "Volume", detail: volumeDetail },
      { label: "BOSCEM", detail: boscemDetail },
      { label: "Interruption", detail: interruptionDetail },
      { label: "Population density", detail: densityDetail },
      { label: "Natural force", detail: forceDetail },
      { label: "Release", detail: release.level == null ? "Not scored" : String(release.level) },
      { label: "Criticality", detail: modelDetail(item.criticality_score, item.criticality_status) },
      { label: "Groundwater", detail: modelDetail(item.groundwater_impact_score, item.groundwater_status) },
      { label: "Consequence", detail: consequenceDetail },
    ],
    product:
      item.consequence == null || item.risk == null
        ? "Not scored"
        : `${item.likelihood} × ${item.consequence} = ${item.risk}`,
  };
}

export function riskBreakdown(item: IncidentProperties): RiskBreakdown {
  const likelihood = likelihoodLevel(item.reported, item.n, item.never_inspected);
  const consequence = foldedConsequence(item);
  const likelihoodNote = likelihood.level === item.likelihood ? likelihood.note : "";
  const consequenceNote =
    item.consequence != null && consequence.level === item.consequence ? consequence.note : "";
  const productNote = item.consequence == null ? "" : `${item.likelihood} × ${item.consequence}`;
  return { likelihoodNote, consequenceNote, productNote };
}

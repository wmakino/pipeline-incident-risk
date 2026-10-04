import type { IncidentProperties } from "@/lib/incidents";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function formatVolume(value: number): string {
  return value.toLocaleString("en-CA", { maximumFractionDigits: 3 });
}

function textProp(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function consequenceLine(item: IncidentProperties): string {
  if (item.consequence == null) return "Consequence not scored";
  const volume =
    item.volume_m3 == null
      ? "volume not reported"
      : `${formatVolume(item.volume_m3)} m³ ${item.release_type}`;
  return `Consequence ${item.consequence} ${escapeHtml(item.consequence_name)} (${escapeHtml(volume)})`;
}

function riskLine(item: IncidentProperties): string {
  if (item.risk == null) return "Risk not scored";
  return `Risk ${item.risk}`;
}

function aquiferLine(item: IncidentProperties): string {
  if (item.avi_status === "available" && item.avi_index != null) {
    return `Aquifer vulnerability ${item.avi_index} of 6. Not part of the risk score.`;
  }
  return "Aquifer vulnerability not surveyed here. Not part of the risk score.";
}

function modelLine(label: string, score: number | null | undefined, status: string | undefined): string {
  if (!status) return "";
  const value = score == null ? "not scored" : String(score);
  const included = status === "scored" && score != null;
  const note = included ? "Included in consequence." : "Not scored, so left out of consequence.";
  return `${label} ${value} (${escapeHtml(status)}). ${note}<br>`;
}

export function incidentPopup(item: IncidentProperties): string {
  const closed = item.closed_date_blank ? "Yes" : "No";
  return (
    `<strong>${escapeHtml(item.incident_id)}</strong><br>` +
    `${escapeHtml(item.company)}, ${escapeHtml(item.province)}<br>` +
    `Reported ${escapeHtml(item.reported)}<br>` +
    `Likelihood ${item.likelihood} ${escapeHtml(item.level_name)}<br>` +
    `${consequenceLine(item)}<br>` +
    `${riskLine(item)}<br>` +
    `${escapeHtml(item.nearest_populated_centre)}<br>` +
    `${escapeHtml(item.population_density)}<br>` +
    `Recency ${formatNumber(item.recency)}<br>` +
    `Nearby ${formatNumber(item.nearby)} (n=${item.n})<br>` +
    `Never inspected ${item.never_inspected}<br>` +
    `Routine program ${item.routine_program_inspection}<br>` +
    `Interruption ${escapeHtml(item.interruption || "not reported")}<br>` +
    `${aquiferLine(item)}<br>` +
    modelLine("Criticality", item.criticality_score, item.criticality_status) +
    modelLine("Groundwater impact", item.groundwater_impact_score, item.groundwater_status) +
    `Closed date blank ${closed}`
  );
}

export function linePopup(props: Record<string, unknown>): string {
  return (
    `<strong>${escapeHtml(textProp(props.Pipeline_Name))}</strong><br>` +
    `${escapeHtml(textProp(props.Company))}<br>` +
    `${escapeHtml(textProp(props.Commodity))}`
  );
}

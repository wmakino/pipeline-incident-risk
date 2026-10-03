export type LikelihoodLevel = 1 | 2 | 3 | 4 | 5;

export const LEVEL_NAMES: Record<LikelihoodLevel, string> = {
  1: "Rare",
  2: "Unlikely",
  3: "Possible",
  4: "Likely",
  5: "Almost certain",
};

const RAMP_BLUE = [0x2c, 0x7b, 0xb6];
const RAMP_YELLOW = [0xfe, 0xe0, 0x90];
const RAMP_RED = [0xd7, 0x19, 0x1c];

export const RISK_MAX = 25;
export const UNSCORED_COLOR = "#cfc8be";

export const CONSEQUENCE_NAMES: Record<LikelihoodLevel, string> = {
  1: "Slight",
  2: "Limited",
  3: "Moderate",
  4: "Major",
  5: "Severe",
};

export type MapSignal = "likelihood" | "consequence" | "risk";

function mix(start: number[], end: number[], t: number): string {
  const channels = start.map((channel, index) => Math.round(channel + (end[index] - channel) * t));
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

export function scaleColor(t: number): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  if (clamped <= 0.5) return mix(RAMP_BLUE, RAMP_YELLOW, clamped / 0.5);
  return mix(RAMP_YELLOW, RAMP_RED, (clamped - 0.5) / 0.5);
}

function luminance(hex: string): number {
  const channels = [0, 1, 2].map((index) => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function levelColor(level: LikelihoodLevel): string {
  return scaleColor((level - 1) / 4);
}

export function signalValue(item: IncidentProperties, signal: MapSignal): number | null {
  if (signal === "likelihood") return item.likelihood;
  if (signal === "consequence") return item.consequence;
  return item.risk;
}

export function signalColor(value: number | null, signal: MapSignal): string {
  if (value == null) return UNSCORED_COLOR;
  if (signal === "risk") return scaleColor((value - 1) / (RISK_MAX - 1));
  return levelColor(value as LikelihoodLevel);
}

export function signalRadius(value: number | null, signal: MapSignal): number {
  if (value == null) return 4;
  const span = signal === "risk" ? RISK_MAX - 1 : 4;
  return 4 + ((value - 1) / span) * 5;
}

export function signalTextColor(value: number | null, signal: MapSignal): string {
  if (value == null) return "#1c2836";
  return luminance(signalColor(value, signal)) < 0.35 ? "#f7fbff" : "#1c2836";
}

export function signalLabel(value: number | null, signal: MapSignal): string {
  if (value == null) return "not scored";
  if (signal === "likelihood") return `${value} ${LEVEL_NAMES[value as LikelihoodLevel]}`;
  if (signal === "consequence") return `${value} ${CONSEQUENCE_NAMES[value as LikelihoodLevel]}`;
  return String(value);
}

export type IncidentProperties = {
  incident_id: string;
  reported: string;
  company: string;
  province: string;
  recency: number;
  n: number;
  nearby: number;
  never_inspected: "Yes" | "No";
  never_inspected_factor: number;
  routine_program_inspection: "Yes" | "No";
  closed_date_blank: boolean;
  likelihood: LikelihoodLevel;
  level_name: string;
  color: string;
  radius: number;
  consequence: LikelihoodLevel | null;
  consequence_name: string;
  risk: number | null;
  release_type: string;
  volume_m3: number | null;
  population_density: string;
  nearest_populated_centre: string;
  elevated_density: boolean;
  category_step: boolean;
};

export type IncidentCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: IncidentProperties;
  }>;
};

export type LevelCount = {
  level: LikelihoodLevel;
  name: string;
  color: string;
  count: number;
};

export type LikelihoodSummary = {
  plotted: number;
  first: string;
  last: string;
  levels: LevelCount[];
};

export function summarize(collection: IncidentCollection): LikelihoodSummary {
  const features = collection.features;
  const first = features.reduce(
    (earliest, feature) =>
      feature.properties.reported < earliest ? feature.properties.reported : earliest,
    features[0].properties.reported,
  );
  const last = features.reduce(
    (latest, feature) =>
      feature.properties.reported > latest ? feature.properties.reported : latest,
    features[0].properties.reported,
  );

  const levels: LevelCount[] = ([5, 4, 3, 2, 1] as LikelihoodLevel[]).map((level) => ({
    level,
    name: LEVEL_NAMES[level],
    color: levelColor(level),
    count: features.filter((feature) => feature.properties.likelihood === level).length,
  }));

  return {
    plotted: features.length,
    first,
    last,
    levels,
  };
}

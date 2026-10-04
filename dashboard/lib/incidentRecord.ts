export const LIST_COLUMNS = [
  "incident_number",
  "company",
  "province",
  "reported_date",
  "likelihood",
  "consequence",
  "risk",
  "criticality_score",
  "groundwater_impact_score",
] as const;

export type IncidentRow = Record<string, unknown>;

export type RecordField = {
  column: string;
  label: string;
  value: string;
};

export type RecordGroup = {
  id: string;
  title: string;
  fields: RecordField[];
};

const GROUPS: { id: string; title: string; columns: string[] }[] = [
  {
    id: "identity",
    title: "Identity",
    columns: [
      "incident_number",
      "reported_date",
      "year",
      "closed_date",
      "status",
      "company",
      "province",
      "country",
      "nearest_populated_centre",
      "latitude",
      "longitude",
      "loaded_at",
    ],
  },
  {
    id: "what",
    title: "What happened",
    columns: [
      "incident_types",
      "incident_type",
      "occurrence_date_and_time",
      "discovered_date_and_time",
      "activity_being_performed_at_time_of_incident",
      "how_the_incident_was_discovered",
      "what_happened_category",
      "detailed_what_happened",
      "why_it_happened_category",
      "detailed_why_it_happened",
    ],
  },
  {
    id: "release",
    title: "Release",
    columns: [
      "release_type",
      "substance",
      "substance_carried",
      "approximate_volume_released_m3",
      "released_substance_type",
      "released_volume_m3",
      "significant",
      "rupture",
      "pipe_body_release",
      "residual_effects_on_the_environment",
      "duration_of_interruption_of_pipeline_operations",
    ],
  },
  {
    id: "harm",
    title: "Harm",
    columns: [
      "number_of_fatalities",
      "activity_at_time_of_fatality",
      "number_of_individuals_injured",
      "type_of_injury",
      "workdays_lost",
      "work_restricted_by_injury",
      "number_of_people_evacuated",
      "source_of_explosion",
      "source_of_fire",
      "conditions_that_resulted_in_the_operation_beyond_limits",
      "conditions_that_resulted_in_adverse_effects_on_the_environment",
    ],
  },
  {
    id: "place",
    title: "Place",
    columns: [
      "land_use",
      "population_density",
      "kilometre_post",
      "emergency_level",
      "facility_name",
      "facility_type",
      "facility_latitude",
      "facility_longitude",
      "affects_company_property",
      "off_company_property",
      "affects_pipeline_right_of_way",
      "affects_off_pipeline_right_of_way",
      "regulation",
      "investigation_type",
      "was_neb_staff_deployed",
      "related_neb_event_number",
    ],
  },
  {
    id: "asset",
    title: "Asset",
    columns: [
      "pipeline_name",
      "pipeline_or_facility_type",
      "pipeline_length_km",
      "pipeline_or_facility_equipment_involved",
      "equipment_or_component_involved",
      "pipeline_outside_diameter_nps",
      "nominal_pipe_size",
      "design_standard",
      "material",
      "material_grade",
      "schedule",
      "design_wall_thickness_mm",
      "custom_design_wall_thickness_mm",
      "actual_wall_thickness_mm",
      "licensed_maximum_operating_pressure_kpa",
      "restricted_operating_pressure_kpa",
      "actual_operating_pressure_at_time_of_failure_kpa",
      "designed_depth_of_cover_m",
      "actual_depth_of_cover_m",
      "year_of_manufacture",
      "year_of_installation",
      "year_when_put_into_service",
      "most_recent_cathodic_protection_reading_at_incident_site_mv_vs_cu_cuso4",
      "weld_type",
      "seam_type",
      "seam_joining_method",
      "seam_clock_position",
      "coating_location",
      "coating_type",
      "coating_condition",
      "application_method",
      "year_when_the_coating_was_applied",
      "insulation_installed",
      "repair_type",
      "repair_date",
    ],
  },
  {
    id: "inspection",
    title: "Inspection",
    columns: [
      "equipment_or_component_has_never_been_inspected",
      "most_recent_inspection_date_for_the_failed_equipment_or_component",
      "type_of_most_recent_inspection",
      "most_recent_inspection_part_of_the_routine_inspection_program",
      "no_maintenance_done_on_this_equipment_or_component",
      "date_of_the_most_recent_maintenance_work_for_the_failed_equipment_or_component",
      "most_recent_maintenance_type",
      "most_recent_maintenance_work_part_of_the_routine_maintenance_program",
    ],
  },
  {
    id: "scores",
    title: "Scores",
    columns: [
      "likelihood",
      "consequence",
      "risk",
      "boscem_cost",
      "boscem_level",
      "consequence_base",
      "elevated_density",
      "category_step",
      "recency",
      "n",
      "nearby",
      "never_inspected_factor",
      "scores_scored_at",
    ],
  },
  {
    id: "models",
    title: "Model readings",
    columns: [
      "criticality_score",
      "criticality_status",
      "criticality_confidence",
      "threat_category",
      "criticality_reasoning",
      "criticality_scored_at",
      "groundwater_impact_score",
      "groundwater_status",
      "groundwater_confidence",
      "avi_index",
      "avi_status",
      "groundwater_reasoning",
      "groundwater_scored_at",
    ],
  },
];

const LABELS: Record<string, string> = {
  n: "Nearby incidents",
  recency: "Recency factor",
  nearby: "Nearby factor",
  avi_index: "Aquifer vulnerability",
  avi_status: "Aquifer status",
  boscem_cost: "BOSCEM cost",
  boscem_level: "BOSCEM level",
  approximate_volume_released_m3: "Approximate volume released (m3)",
  released_volume_m3: "Released volume (m3)",
  pipeline_outside_diameter_nps: "Pipeline outside diameter (NPS)",
  pipeline_length_km: "Pipeline length (km)",
  design_wall_thickness_mm: "Design wall thickness (mm)",
  custom_design_wall_thickness_mm: "Custom design wall thickness (mm)",
  actual_wall_thickness_mm: "Actual wall thickness (mm)",
  licensed_maximum_operating_pressure_kpa: "Licensed maximum operating pressure (kPa)",
  restricted_operating_pressure_kpa: "Restricted operating pressure (kPa)",
  actual_operating_pressure_at_time_of_failure_kpa: "Actual operating pressure at failure (kPa)",
  designed_depth_of_cover_m: "Designed depth of cover (m)",
  actual_depth_of_cover_m: "Actual depth of cover (m)",
  most_recent_cathodic_protection_reading_at_incident_site_mv_vs_cu_cuso4:
    "Most recent cathodic protection reading (mV vs Cu/CuSO4)",
};

function labelFor(column: string): string {
  const known = LABELS[column];
  if (known) return known;
  const text = column.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function displayValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function assignedColumns(): string[] {
  return GROUPS.flatMap((group) => group.columns);
}

export function recordGroups(row: IncidentRow): RecordGroup[] {
  const groups: RecordGroup[] = [];
  for (const group of GROUPS) {
    const fields: RecordField[] = [];
    for (const column of group.columns) {
      const value = row[column];
      if (isBlank(value)) continue;
      fields.push({ column, label: labelFor(column), value: displayValue(value) });
    }
    if (fields.length > 0) groups.push({ id: group.id, title: group.title, fields });
  }
  return groups;
}

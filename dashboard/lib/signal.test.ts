import assert from "node:assert/strict";
import test from "node:test";
import {
  RISK_MAX,
  UNSCORED_COLOR,
  levelColor,
  signalColor,
  signalRadius,
  signalValue,
  type IncidentProperties,
} from "./incidents.ts";

function item(partial: Partial<IncidentProperties>): IncidentProperties {
  return {
    incident_id: "INC",
    reported: "2026-09-25",
    company: "Example",
    province: "Alberta",
    recency: 1,
    n: 0,
    nearby: 1,
    never_inspected: "No",
    never_inspected_factor: 1,
    routine_program_inspection: "No",
    closed_date_blank: false,
    likelihood: 4,
    level_name: "Likely",
    color: "#000000",
    radius: 8,
    consequence: 3,
    consequence_name: "Moderate",
    risk: 12,
    release_type: "Gas",
    volume_m3: 1000,
    substance: "",
    land_use: "",
    boscem_cost: null,
    boscem_level: null,
    population_density: "10 or fewer dwelling units",
    nearest_populated_centre: "Edmonton",
    elevated_density: false,
    category_step: false,
    interruption: "",
    avi_index: null,
    avi_status: "no_coverage",
    ...partial,
  };
}

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

test("risk runs from blue at 1 to red at 25", () => {
  const low = signalColor(1, "risk");
  const high = signalColor(RISK_MAX, "risk");
  assert.equal(low, levelColor(1));
  assert.equal(high, levelColor(5));
  assert.ok(channel(low, 2) > channel(high, 2));
  assert.ok(channel(high, 0) > channel(low, 0));
  assert.notEqual(signalColor(13, "risk"), low);
  assert.notEqual(signalColor(13, "risk"), high);
});

test("likelihood and consequence keep the five level colors", () => {
  assert.equal(signalColor(4, "likelihood"), levelColor(4));
  assert.equal(signalColor(2, "consequence"), levelColor(2));
});

test("a missing consequence has no risk color", () => {
  const row = item({ consequence: null, consequence_name: "", risk: null });
  assert.equal(signalValue(row, "likelihood"), 4);
  assert.equal(signalValue(row, "consequence"), null);
  assert.equal(signalValue(row, "risk"), null);
  assert.equal(signalColor(null, "risk"), UNSCORED_COLOR);
  assert.equal(signalColor(null, "consequence"), UNSCORED_COLOR);
});

test("circle size follows the selected part of the product", () => {
  assert.equal(signalRadius(1, "risk"), 4);
  assert.equal(signalRadius(RISK_MAX, "risk"), 9);
  assert.ok(signalRadius(12, "risk") > signalRadius(1, "risk"));
  assert.equal(signalRadius(5, "likelihood"), 9);
  assert.equal(signalRadius(null, "risk"), 4);
});

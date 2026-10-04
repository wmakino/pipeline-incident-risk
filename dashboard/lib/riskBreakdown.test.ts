import assert from "node:assert/strict";
import test from "node:test";
import { riskBreakdown, riskFactors } from "./riskBreakdown.ts";
import type { IncidentProperties, LikelihoodLevel } from "./incidents.ts";

function item(overrides: Partial<IncidentProperties> = {}): IncidentProperties {
  return {
    incident_id: "INC-1",
    reported: "2026-06-01",
    company: "Example",
    province: "Alberta",
    recency: 0.8,
    n: 0,
    nearby: 1,
    never_inspected: "No",
    never_inspected_factor: 1,
    routine_program_inspection: "No",
    closed_date_blank: false,
    likelihood: 4,
    level_name: "High",
    color: "#000",
    radius: 4,
    consequence: 3,
    consequence_name: "Moderate",
    risk: 12,
    release_type: "Gas",
    volume_m3: 1_000,
    substance: "Natural Gas - Sweet",
    land_use: "",
    boscem_cost: null,
    boscem_level: null,
    population_density: "",
    nearest_populated_centre: "Edson",
    elevated_density: false,
    category_step: false,
    interruption: "",
    avi_index: null,
    avi_status: "no_coverage",
    ...overrides,
  };
}

function scored(likelihood: LikelihoodLevel, consequence: LikelihoodLevel | null, overrides: Partial<IncidentProperties> = {}) {
  return item({
    likelihood,
    consequence,
    risk: consequence == null ? null : likelihood * consequence,
    ...overrides,
  });
}

test("a plain recent release is the age band times the volume band", () => {
  const breakdown = riskBreakdown(scored(4, 3));
  assert.equal(breakdown.likelihoodNote, "under 1 year");
  assert.equal(breakdown.consequenceNote, "volume 3");
  assert.equal(breakdown.productNote, "4 × 3");
});

test("neighbor and never inspected add to an older base", () => {
  const breakdown = riskBreakdown(
    scored(3, 1, {
      reported: "2020-01-01",
      n: 1,
      never_inspected: "Yes",
      release_type: "Liquid",
      volume_m3: 1,
    }),
  );
  assert.equal(breakdown.likelihoodNote, "3 years or older + neighbor + never inspected");
  assert.equal(breakdown.consequenceNote, "volume 1");
});

test("both steps on a recent incident cap likelihood at 5", () => {
  const breakdown = riskBreakdown(
    scored(5, 1, {
      reported: "2026-09-01",
      n: 2,
      never_inspected: "Yes",
      release_type: "Liquid",
      volume_m3: 1,
    }),
  );
  assert.equal(breakdown.likelihoodNote, "under 1 year + neighbor + never inspected, capped at 5");
});

test("BOSCEM replaces volume, then density and a natural-force step add", () => {
  const breakdown = riskBreakdown(
    scored(4, 5, {
      release_type: "Liquid",
      volume_m3: 500,
      boscem_level: 3,
      elevated_density: true,
      category_step: true,
    }),
  );
  assert.equal(breakdown.consequenceNote, "BOSCEM 3 + density + natural force = 5");
});

test("steps that pass 5 are capped", () => {
  const breakdown = riskBreakdown(
    scored(4, 5, {
      release_type: "Liquid",
      volume_m3: 1,
      boscem_level: 4,
      interruption: "Long-term interruption",
      elevated_density: true,
      category_step: true,
    }),
  );
  assert.equal(
    breakdown.consequenceNote,
    "BOSCEM 4 + long interruption + density + natural force, capped at 5",
  );
});

test("a scored criticality and groundwater average with the release", () => {
  const breakdown = riskBreakdown(
    scored(4, 4, {
      release_type: "Liquid",
      volume_m3: 1,
      criticality_score: 5,
      criticality_status: "scored",
      groundwater_impact_score: 5,
      groundwater_status: "scored",
    }),
  );
  assert.equal(
    breakdown.consequenceNote,
    "volume 1; averaged with criticality 5 and groundwater 5 = 4",
  );
});

test("a low model score cannot pull the release down", () => {
  const breakdown = riskBreakdown(
    scored(4, 4, {
      volume_m3: 100_000,
      criticality_score: 1,
      criticality_status: "scored",
    }),
  );
  assert.equal(breakdown.consequenceNote, "volume 4; averaged with criticality 1, held at 4");
});

test("an unscored model is left out of the average", () => {
  const breakdown = riskBreakdown(
    scored(4, 3, {
      criticality_score: 5,
      criticality_status: "failed",
      groundwater_impact_score: 5,
      groundwater_status: "insufficient_input",
    }),
  );
  assert.equal(breakdown.consequenceNote, "volume 3");
});

test("occupancy or an interruption can be the base when volume is missing", () => {
  assert.equal(
    riskBreakdown(scored(4, 1, { volume_m3: null, elevated_density: true })).consequenceNote,
    "occupancy = 1",
  );
  assert.equal(
    riskBreakdown(
      scored(4, 4, { volume_m3: null, interruption: "Long-term interruption" }),
    ).consequenceNote,
    "long interruption = 4",
  );
});

test("a model score is the consequence when the release was not scored", () => {
  assert.equal(
    riskBreakdown(
      scored(4, 4, {
        volume_m3: null,
        criticality_score: 4,
        criticality_status: "scored",
      }),
    ).consequenceNote,
    "criticality 4",
  );
  assert.equal(
    riskBreakdown(
      scored(4, 4, {
        volume_m3: null,
        criticality_score: 5,
        criticality_status: "scored",
        groundwater_impact_score: 3,
        groundwater_status: "scored",
      }),
    ).consequenceNote,
    "criticality 5 and groundwater 3 = 4",
  );
});
test("a note is withheld when the stored level does not match the inputs", () => {
  const breakdown = riskBreakdown(scored(1, 5, { volume_m3: 1_000 }));
  assert.equal(breakdown.likelihoodNote, "");
  assert.equal(breakdown.consequenceNote, "");
  assert.equal(breakdown.productNote, "1 × 5");
});

test("opening an incident lists every factor, including ones that add nothing", () => {
  const report = riskFactors(
    scored(4, 4, {
      reported: "2026-06-01",
      n: 0,
      never_inspected: "No",
      volume_m3: 1_000,
      criticality_score: 5,
      criticality_status: "failed",
      groundwater_status: "insufficient_input",
    }),
  );
  assert.deepEqual(
    report.likelihood.map((line) => line.label),
    ["Reported age", "Neighbor", "Never inspected", "Likelihood"],
  );
  assert.equal(report.likelihood[1].detail, "No, adds nothing");
  assert.equal(report.likelihood[2].detail, "No, adds nothing");
  assert.deepEqual(
    report.consequence.map((line) => line.label),
    [
      "Volume",
      "BOSCEM",
      "Interruption",
      "Population density",
      "Natural force",
      "Release",
      "Criticality",
      "Groundwater",
      "Consequence",
    ],
  );
  assert.equal(report.consequence[1].detail, "Not used");
  assert.equal(report.consequence[2].detail, "None, adds nothing");
  assert.equal(report.consequence[6].detail, "failed, left out");
  assert.equal(report.consequence[7].detail, "insufficient input, left out");
  assert.equal(report.product, "4 × 4 = 16");
});

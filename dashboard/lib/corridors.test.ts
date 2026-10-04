import assert from "node:assert/strict";
import test from "node:test";
import { rankCorridors, rankIncidents, corridorDetail } from "./corridors.ts";
import type { IncidentCollection, IncidentProperties, LikelihoodLevel } from "./incidents.ts";

function feature(
  id: string,
  centre: string,
  consequence: LikelihoodLevel | null,
  likelihood: 1 | 2 | 3 | 4 | 5,
  substance: string,
  overrides: Partial<IncidentProperties> = {},
): IncidentCollection["features"][number] {
  const item = {
    incident_id: id,
    reported: "2024-01-01",
    company: "Example",
    province: "Alberta",
    recency: 0.5,
    n: 0,
    nearby: 1,
    never_inspected: "No",
    never_inspected_factor: 1,
    routine_program_inspection: "No",
    closed_date_blank: false,
    likelihood,
    level_name: "Likely",
    color: "#000",
    radius: 4,
    consequence,
    consequence_name: "",
    risk: consequence == null ? null : likelihood * consequence,
    release_type: "Gas",
    volume_m3: null,
    substance,
    land_use: "",
    boscem_cost: null,
    boscem_level: null,
    population_density: "",
    nearest_populated_centre: centre,
    elevated_density: false,
    category_step: false,
    interruption: "",
    avi_index: null,
    avi_status: "no_coverage",
    ...overrides,
  } satisfies IncidentProperties;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-114, 53] },
    properties: item,
  };
}

test("a single high-risk incident outranks a town full of low-risk incidents", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("a1", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("a2", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("a3", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("a4", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("a5", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("b1", "Hardisty", 4, 4, "Crude Oil - Sweet"),
    ],
  };
  const ranking = rankCorridors(collection, 15);
  assert.equal(ranking.rows[0].corridor, "Hardisty");
  assert.equal(ranking.rows[0].score, 16);
  assert.equal(ranking.rows[1].corridor, "Edson");
  assert.equal(ranking.rows[1].score, 5);
});

test("unscored counts a named town with no risk and skips an unusable town", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("a1", "Edson", 2, 3, "Natural Gas - Sweet"),
      feature("a2", "Edson", null, 5, "Natural Gas - Sweet"),
      feature("b1", "Not specified", null, 5, "Natural Gas - Sweet"),
    ],
  };
  const ranking = rankCorridors(collection, 15);
  assert.equal(ranking.unscored, 1);
  assert.equal(ranking.total_incidents, 2);
  assert.equal(ranking.unplaced, 1);
  assert.equal(ranking.rows[0].score, 6);
  assert.equal(ranking.rows[0].incidents, 2);
  const detail = corridorDetail(collection, "edson");
  assert.equal(
    detail?.summary,
    "Edson has 2 Alberta incidents. Each scored incident is likelihood times consequence, the same number as on the map. The highest is 6. The town total is 6, the sum of those risks.",
  );
});

test("top incidents follow likelihood times consequence and skip unscored releases", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("a1", "Edson", 1, 1, "Natural Gas - Sweet"),
      feature("a2", "Edson", null, 5, "Natural Gas - Sweet"),
      feature("b1", "Hardisty", 4, 4, "Crude Oil - Sweet"),
    ],
  };
  const ranking = rankIncidents(collection, 15);
  assert.equal(ranking.scored, 2);
  assert.equal(ranking.rows[0].incident_id, "b1");
  assert.equal(ranking.rows[0].score, 16);
  assert.equal(ranking.rows[0].corridor_id, "hardisty");
  assert.equal(ranking.rows[1].incident_id, "a1");
});

test("a top incident shows the steps behind likelihood times consequence", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("b1", "Hardisty", 4, 4, "Crude Oil - Sweet", {
        reported: "2026-06-01",
        release_type: "Liquid",
        volume_m3: 1,
        criticality_score: 5,
        criticality_status: "scored",
        groundwater_impact_score: 5,
        groundwater_status: "scored",
      }),
    ],
  };
  const ranking = rankIncidents(collection, 15);
  assert.equal(ranking.rows[0].likelihood_note, "under 1 year");
  assert.equal(ranking.rows[0].consequence_note, "volume 1; averaged with criticality 5 and groundwater 5 = 4");
  assert.equal(ranking.rows[0].product_note, "4 × 4");
});

test("an incident with no consequence adds nothing to the town total", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("a1", "Edson", 2, 3, "Natural Gas - Sweet"),
      feature("a2", "Edson", null, 5, "Natural Gas - Sweet"),
    ],
  };
  const ranking = rankCorridors(collection, 15);
  assert.equal(ranking.rows[0].score, 6);
  assert.equal(ranking.rows[0].incidents, 2);
});

test("opening a corridor lists every factor for each incident", () => {
  const collection: IncidentCollection = {
    type: "FeatureCollection",
    features: [
      feature("b1", "Hardisty", 4, 4, "Crude Oil - Sweet", {
        reported: "2026-06-01",
        release_type: "Liquid",
        volume_m3: 1,
      }),
    ],
  };
  const detail = corridorDetail(collection, "hardisty");
  assert.ok(detail);
  assert.deepEqual(
    detail.items[0].likelihood.map((line) => line.label),
    ["Reported age", "Neighbor", "Never inspected", "Likelihood"],
  );
  assert.equal(detail.items[0].likelihood[1].detail, "No, adds nothing");
  assert.equal(detail.items[0].consequence.length, 9);
  assert.equal(detail.items[0].consequence[7].detail, "Not scored, left out");
  assert.equal(detail.items[0].product, "4 × 4 = 16");
});

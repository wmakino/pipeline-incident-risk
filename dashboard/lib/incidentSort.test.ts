import assert from "node:assert/strict";
import test from "node:test";
import { sortIncidentRows, type SortableIncident } from "./incidentSort.ts";

function row(partial: Partial<SortableIncident> & Pick<SortableIncident, "incident_number">): SortableIncident {
  return {
    company: "",
    province: "",
    reported_date: "",
    likelihood: null,
    consequence: null,
    risk: null,
    criticality_score: null,
    groundwater_impact_score: null,
    ...partial,
  };
}

test("risk descending keeps blanks last", () => {
  const sorted = sortIncidentRows(
    [
      row({ incident_number: "B", risk: null }),
      row({ incident_number: "A", risk: 4 }),
      row({ incident_number: "C", risk: 20 }),
    ],
    { key: "risk", direction: "desc" },
  );
  assert.deepEqual(sorted.map((item) => item.incident_number), ["C", "A", "B"]);
});

test("risk ascending still keeps blanks last", () => {
  const sorted = sortIncidentRows(
    [
      row({ incident_number: "B", risk: null }),
      row({ incident_number: "A", risk: 20 }),
      row({ incident_number: "C", risk: 4 }),
    ],
    { key: "risk", direction: "asc" },
  );
  assert.deepEqual(sorted.map((item) => item.incident_number), ["C", "A", "B"]);
});

test("reported dates sort by calendar, not the text", () => {
  const sorted = sortIncidentRows(
    [
      row({ incident_number: "late", reported_date: "01/02/2021" }),
      row({ incident_number: "early", reported_date: "12/01/2020" }),
    ],
    { key: "reported_date", direction: "asc" },
  );
  assert.deepEqual(sorted.map((item) => item.incident_number), ["early", "late"]);
});

test("company sorts alphabetically and ties fall back to incident number", () => {
  const sorted = sortIncidentRows(
    [
      row({ incident_number: "B", company: "Beta" }),
      row({ incident_number: "A2", company: "Alpha" }),
      row({ incident_number: "A1", company: "Alpha" }),
    ],
    { key: "company", direction: "asc" },
  );
  assert.deepEqual(sorted.map((item) => item.incident_number), ["A1", "A2", "B"]);
});

# Incident likelihood

Each incident gets its own likelihood. Nothing rolls up to a town, a company, or a pipeline name. The number ranks the next crew stop. It does not certify a line as safe.

This slice scores likelihood only. Consequence, the spoken brief, and the daily list are out of scope.

The published likelihood is an integer from 1 to 5, on a risk-assessment table. The level ranks the next crew stop from reported history. It is not a forecast that another release will happen. Recency, the nearby count `n`, the nearby factor, and the never-inspected factor stay on the record so a level can be checked.

## Formula

Base level from years before the as-of date, Reported Date only:

- under 1 year → 4
- 1 year up to under 3 years → 3
- 3 years or older → 1

Then add one step for each, and cap the total at 5:

- `n ≥ 1` (a repeated history on the site, or another site under 100 m)
- never inspected = Yes

Never inspected = No does not subtract. A missing coordinate adds no neighbor step. An isolate's lowest level is 1.

The base row skips 2 on purpose. With integers only, that drop keeps a plain incident from the last year above an older incident that has both steps. A 3-year-or-older incident with both steps lands on 3 and ties a plain incident from the 1-to-3-year band.

Level names: 1 Rare, 2 Unlikely, 3 Possible, 4 Likely, 5 Almost certain.

### Factors behind the steps

`recency = 1 / (1 + years)` and `nearby = 1 + n / (n + 1)` stay on the record. They are the evidence behind the recency band and the nearby step. They are no longer multiplied into the published score.

### Recency

As-of date is 2026-09-25. Years come from Reported Date only.

```
years = max(0, (as-of − reported date).days / 365.25)
recency = 1 / (1 + years)
```

A report on the as-of date scores 1. A report dated one year earlier scores `1 / (1 + days/365.25)` using the actual day count. A reported date after the as-of date is clamped to 0 years. Closed Date is not an input.

### Sites

A site is one exact stored latitude/longitude pair. Both values must be finite numbers. A missing or non-finite coordinate is not a site.

Distances between sites are Vincenty metres on the WGS84 ellipsoid (`pyproj.Geod`). Another site counts only when that distance is strictly under 100 m.

### Nearby

For the site an incident sits on:

```
n = (1 if this site has 2 or more incidents else 0)
    + (count of other sites under 100 m)

nearby = 1 + n / (n + 1)
```

A lone incident with no other site under 100 m has `n = 0` and nearby = 1. Ten incidents on one point, with nothing else under 100 m, have `n = 1` and nearby = 1.5. One other site under 100 m, and no pile, is also 1.5. Further sites add less. The term approaches 2 and stays below 2.

Closed incidents stay in the site count. Every incident on a site shares the same `n`. Recency and the never-inspected flag stay per incident, so two rows on one site can receive different likelihoods.

An incident with no usable coordinate still scores. `n = 0`, nearby = 1, and `coordinates_missing` is true. The row is kept. It is not given a neighbor. The flag separates that row from a real isolate, which has the same nearby value and `coordinates_missing` false.

### Never inspected

Yes → factor 1.5 and one step. No → factor 1 and no step.

## Printed with the score, not scored

These fields are on the result and do not change the level:

- Routine-program inspection (Yes or No)
- Blank Closed Date (paperwork flag)

## Out of this score

- Corridor (company + Pipeline Name)
- Inspection date
- Closed Date as a time multiplier
- Injuries and fatalities
- Consequence, volume, and release type
- Town or population rollups

## Result

`score_incidents` keeps input order and returns one record per incident:

| Field | Meaning |
|---|---|
| `incident_id` | Caller-supplied id |
| `recency` | Recency factor |
| `n` | Neighbor count defined above. 0 when coordinates are missing |
| `nearby` | Nearby factor |
| `never_inspected` | The source flag |
| `never_inspected_factor` | 1.5 or 1 |
| `likelihood` | Integer 1-5 from the risk table |
| `routine_program_inspection` | Copied through, not scored |
| `closed_date_blank` | Copied through, not scored |
| `coordinates_missing` | True when latitude or longitude is missing or non-finite |

## Edges

- Dates used by this function are `datetime.date` values. Parsing `MM/DD/YYYY` belongs to the file loader, which this slice does not include.
- An empty input returns an empty list.
- Duplicate incident ids are scored independently. This function does not check uniqueness.

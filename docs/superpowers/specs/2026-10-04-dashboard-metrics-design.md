# Dashboard facts, without a count comparison

The home page ranks Alberta towns by the sum of likelihood times consequence. That rank stays. The page stops comparing the rank with a plain incident count.

On the current file the five busiest towns are the same five towns after scoring, so the comparison reads as zero of five. This slice removes that comparison and fills the page with figures from the file.

## Page

Order stays: hero, map, stats, priority list, method, export. The comparison band is gone. The nav item labeled Compare is gone. Inspect list and Method stay, as do the page links for Incidents, Map, and About.

### Hero

The paragraph is:

> CorridorWatch ranks Alberta pipeline towns by likelihood times consequence. {total} Alberta incidents from 2008 to 2026.

`{total}` is `total_incidents`, with thousands separators. When the ranking has not loaded, the second sentence is omitted.

The card title stays "Highest town risk". Each of the top three rows shows the rank, the town, and the town total. Under the town name, one line reads "{product} · {count} incidents", or "1 incident" when the count is 1. The score caption stays "risk score". The card has no footer.

### Stats

Four figures. A missing ranking renders an em dash in the value. The fourth caption is an em dash until a ranking exists. The third caption is an em dash when the ranking has no rows.

| Value | Label | Caption |
| --- | --- | --- |
| `total_incidents` | Alberta incidents | 2008 to 2026 |
| `total_corridors` | Towns | Top 15 listed below |
| score of the first row | Highest town risk | that town's name |
| `unscored` | Unscored incidents | No consequence, so they add nothing |

`unscored` counts Alberta incidents that have a usable town name and a null risk. The same town-name rules as the ranking apply. Incidents already excluded as unplaced are not in this count. `total_incidents` still counts every placed incident, scored or not.

### Priority list

Town columns are #, Corridor, Product, Incidents, Risk score, and the row affordance. The consequence badge and the "vs count-only" column are gone. The score bar stays on the risk score and keeps its current color, the town's worst consequence.

The incident table is unchanged. Its columns stay #, Incident, Town, Product, Likelihood, Consequence, and Risk score.

The footnote under the town table still reports how many corridors are shown and how many incidents were left out because the nearest town was missing or unusable.

### Method and export

The method block stays as written.

The CSV columns are Rank, Corridor, Product, Incidents, Risk score, Lat, Lng.

## Town drawer

The drawer shows three figures: Risk score, Incidents, and Highest incident. The stat grid is three columns so those three fill the row. The narrow layout stays two columns.

The summary is:

> {town} has {incidents} Alberta incidents. Each scored incident is likelihood times consequence, the same number as on the map. The highest is {peak}. The town total is {score}, the sum of those risks.

## About

The second card in "Why a better list matters" becomes:

- Title: A town is a sum
- Body: Each incident is likelihood times consequence. A town’s rank adds those products.

The other two cards stay.

## Data

`Ranking` gains `unscored` and loses `top5_overlap_with_count_only`.

`RankingRow` loses `count_rank`. Town order stays score descending, then incident count descending, then town name ascending. `consequence` stays on the row for the score-bar color and the drawer's highest-incident color. It is not shown as a High, Medium, or Low badge on the home table or in the CSV.

Delete `dashboard/corridor/sections/CompareSection.tsx`. Delete `shiftLabel` and `ConsequenceBadge` once nothing imports them. Delete the `.compare__*` rules, the `.hero__card-foot` and `.hero__replaced` rules, and the count-rank sort.

## Tests

The existing rank tests still show that one high-risk incident outranks a town of low-risk incidents, and that a null consequence adds nothing to the town total.

Drop the assertion on `count_rank`. One test places two Alberta incidents in a named town, one with a null risk, and one Alberta incident whose town name is unusable and whose risk is also null. `unscored` is 1. `total_incidents` is 2. The town total counts only the scored incident.

## Out of scope

- The likelihood and consequence formulas, and the town total as a sum.
- Map, incident records, and the incident half of the priority list.
- The method copy, the About hero, and the first and third About cards.

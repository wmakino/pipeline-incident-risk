# Dashboard facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the count-versus-risk comparison from the home page and show file facts in its place, without changing the town rank.

**Architecture:** `rankCorridors` stops computing a count rank and an overlap, and reports how many placed incidents have a null risk. The home page, drawer, export, and About card read that ranking and drop every count comparison.

**Tech Stack:** Next.js, React, TypeScript, node:test via `npx tsx --test`.

## Global Constraints

- Town rank stays the sum of likelihood times consequence. Order stays score descending, then incident count descending, then town name ascending.
- `unscored` counts Alberta incidents with a usable town name and a null risk. Unplaced incidents are not in that count. `total_incidents` still counts every placed incident.
- Hero paragraph: "CorridorWatch ranks Alberta pipeline towns by likelihood times consequence. {total} Alberta incidents from 2008 to 2026." Omit the second sentence when the ranking has not loaded.
- Hero card secondary line: "{product} · {count} incidents", or "1 incident" when the count is 1. No footer.
- Stats labels and captions are exactly: "Alberta incidents" / "2008 to 2026"; "Towns" / "Top 15 listed below"; "Highest town risk" / the town name; "Unscored incidents" / "No consequence, so they add nothing". Missing values are an em dash. The fourth caption is an em dash until a ranking exists. The third caption is an em dash when there is no first row.
- Town table columns: #, Corridor, Product, Incidents, Risk score, and the row affordance. The score bar stays, colored by the town's worst consequence.
- Incident table columns stay as they are.
- CSV columns: Rank, Corridor, Product, Incidents, Risk score, Lat, Lng.
- Drawer summary: "{town} has {incidents} Alberta incidents. Each scored incident is likelihood times consequence, the same number as on the map. The highest is {peak}. The town total is {score}, the sum of those risks."
- Drawer stats: Risk score, Incidents, Highest incident. The grid is three columns. The narrow layout stays two columns.
- About card title: "A town is a sum". Body: "Each incident is likelihood times consequence. A town’s rank adds those products."
- Do not change likelihood, consequence, the map, incident records, the method copy, or the other About cards.

---

### Task 1: Ranking facts

**Files:**
- Modify: `dashboard/lib/corridors.test.ts`
- Modify: `dashboard/lib/corridors.ts`
- Modify: `dashboard/corridor/api/types.ts`

**Interfaces:**
- Consumes: `IncidentCollection` from `dashboard/lib/incidents.ts`
- Produces: `Ranking.unscored: number`. `Ranking` has no `top5_overlap_with_count_only`. `RankingRow` has no `count_rank`.

- [x] **Step 1: Write the failing test**

In `dashboard/lib/corridors.test.ts`, delete `assert.equal(ranking.rows[0].count_rank, 2);` from the Hardisty test.

Add:

```ts
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
    "Edson has 2 Alberta incidents with a named town. Each scored incident is likelihood times consequence, the same number as on the map. The highest is 6. The town total is 6, the sum of those risks.",
  );
});
```

- [x] **Step 2: Run test to verify it fails**

Run from `dashboard`: `npx tsx --test lib/corridors.test.ts`

Expected: FAIL because `unscored` is missing and the summary still cites a count rank.

- [x] **Step 3: Write minimal implementation**

In `dashboard/corridor/api/types.ts`, remove `count_rank` from `RankingRow`. On `Ranking`, replace `top5_overlap_with_count_only` with `unscored: number`.

In `scoredRows`, delete the count-order sort and the `count_rank` field.

In `rankCorridors`, delete the overlap calculation. Set `unscored` to the count of `members` whose `item.risk == null`.

In `corridorDetail`, end the summary after "the sum of those risks."

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/corridors.test.ts`

Expected: PASS

### Task 2: Home page, drawer, export, About

**Files:**
- Modify: `dashboard/corridor/sections/Hero.tsx`
- Modify: `dashboard/corridor/sections/StatsBar.tsx`
- Modify: `dashboard/corridor/sections/PriorityList.tsx`
- Modify: `dashboard/corridor/sections/sections.css`
- Modify: `dashboard/corridor/pages/HomePage.tsx`
- Modify: `dashboard/corridor/components/Nav.tsx`
- Modify: `dashboard/corridor/components/ui.tsx`
- Modify: `dashboard/corridor/features/drawer/CorridorDrawer.tsx`
- Modify: `dashboard/corridor/features/drawer/drawer.css`
- Modify: `dashboard/corridor/lib/csv.ts`
- Modify: `dashboard/corridor/pages/AboutPage.tsx`
- Delete: `dashboard/corridor/sections/CompareSection.tsx`

**Interfaces:**
- Consumes: `Ranking.unscored` and `RankingRow` without `count_rank`

- [x] **Step 1: Update the surfaces named above**

Hero drops the dropout footer and the "noisiest" sentence. The secondary line is product and incident count. Stats use the four facts from Global Constraints. The town table drops Consequence and vs count-only. `HomePage` no longer renders `CompareSection`. Nav drops the Compare item. Drawer drops the count-shift tile and uses a three-column stat grid. CSV drops Consequence and Count-only rank. About's second card becomes "A town is a sum". Delete `CompareSection.tsx`, `shiftLabel`, `ConsequenceBadge`, `.compare__*` rules, and `.hero__card-foot` / `.hero__replaced`.

Town row grid: `64px 248px 160px 112px 240px 1fr`.

- [x] **Step 2: Confirm nothing still names the removed fields**

Run from the repo root:

`rg -n "count_rank|top5_overlap|CompareSection|shiftLabel|ConsequenceBadge|count-only|noisiest" dashboard docs/superpowers/plans docs/superpowers/specs --glob '!docs/**'`

Expected: no matches under `dashboard`.

- [x] **Step 3: Run the ranking tests again**

Run from `dashboard`: `npx tsx --test lib/corridors.test.ts`

Expected: PASS

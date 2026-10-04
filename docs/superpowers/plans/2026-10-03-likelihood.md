# Incident likelihood implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score each pipeline incident with likelihood = recency × nearby × never-inspected factor.

**Architecture:** One pure module, `likelihood.py`, turns a list of incident records into scored records in input order. Site identity is an exact coordinate pair. Distances are Vincenty metres via `pyproj.Geod` on WGS84. No file loader, no consequence, no corridor term.

**Tech Stack:** Python 3.10+, pyproj, pytest.

## Global Constraints

- As-of date is 2026-09-25. Recency uses Reported Date only.
- `years = max(0, (as-of − reported).days / 365.25)` and `recency = 1 / (1 + years)`.
- Nearby radius is strictly under 100 m.
- `n = (1 if the site has 2+ incidents else 0) + (other sites under 100 m)`.
- `nearby = 1 + n / (n + 1)`. A site with no neighbor stays at 1.
- Never inspected Yes → 1.5, No → 1.
- Missing or non-finite coordinates: `n = 0`, nearby = 1, `coordinates_missing` true. The incident stays in the list.
- Closed incidents stay in the site count. Blank Closed Date and routine-program inspection are copied onto the result and do not enter the product.
- Do not commit unless the user asks.

---

### Task 1: Failing tests for the likelihood contract

**Files:**
- Create: `tests/test_likelihood.py`
- Create: `requirements.txt`
- Test: `tests/test_likelihood.py`

**Interfaces:**
- Consumes: nothing
- Produces: tests that import `score_incidents`, `IncidentInput`, `nearby_factor`, and `recency_factor` from `likelihood`

- [x] **Step 1: Write the failing tests** covering recency clamp, nearby saturation, the 100 m boundary, pile-as-one-neighbor, closed rows inside the pile, missing coordinates, and flags that must not change the product.

- [x] **Step 2: Run the tests**

Run: `python -m pytest tests/test_likelihood.py -v`

Expected: FAIL because `likelihood` does not exist yet.

### Task 2: Implement the score

**Files:**
- Create: `likelihood.py`
- Test: `tests/test_likelihood.py`

**Interfaces:**
- Consumes: the tests from Task 1
- Produces: `IncidentInput`, `ScoredIncident`, `recency_factor`, `nearby_factor`, `score_incidents`

- [x] **Step 1: Write `likelihood.py`** to the spec in `docs/superpowers/specs/2026-10-03-likelihood-design.md`.

- [x] **Step 2: Run the tests**

Run: `python -m pytest tests/test_likelihood.py -v`

Expected: PASS, 0 failures.

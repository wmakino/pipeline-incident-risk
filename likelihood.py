"""Likelihood for one pipeline incident, on a 1-5 risk-assessment table.

Base level from years before the as-of date (Reported Date only):
    under 1 year -> 4, 1 up to under 3 years -> 3, 3 years or older -> 1.
Then add one step for a nearby history (n >= 1) and one for never inspected,
capped at 5.

The level ranks the next crew stop from reported history. It is not a forecast
that another release will happen, and it does not certify a line as safe.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from pyproj import Geod

AS_OF = date(2026, 9, 25)
RADIUS_M = 100.0
_GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True)
class IncidentInput:
    incident_id: str
    reported: date
    latitude: float | None
    longitude: float | None
    never_inspected: bool
    routine_program_inspection: bool
    closed_date_blank: bool


@dataclass(frozen=True)
class ScoredIncident:
    incident_id: str
    recency: float
    n: int
    nearby: float
    never_inspected: bool
    never_inspected_factor: float
    likelihood: int
    routine_program_inspection: bool
    closed_date_blank: bool
    coordinates_missing: bool


def years_before(reported: date, as_of: date = AS_OF) -> float:
    days = (as_of - reported).days
    if days <= 0:
        return 0.0
    return days / 365.25


def recency_factor(reported: date, as_of: date = AS_OF) -> float:
    return 1.0 / (1.0 + years_before(reported, as_of))


def nearby_factor(n: int) -> float:
    return 1.0 + n / (n + 1)


def never_inspected_factor(never_inspected: bool) -> float:
    if never_inspected:
        return 1.5
    return 1.0


def base_level(reported: date, as_of: date = AS_OF) -> int:
    """Level from recency alone, before any step is added."""
    years = years_before(reported, as_of)
    if years < 1:
        return 4
    if years < 3:
        return 3
    return 1


def likelihood_level(
    reported: date,
    n: int,
    never_inspected: bool,
    as_of: date = AS_OF,
) -> int:
    """Integer 1-5 from the risk table. Steps add then cap at 5."""
    level = base_level(reported, as_of)
    if n >= 1:
        level += 1
    if never_inspected:
        level += 1
    return min(level, 5)


def _coordinates(incident: IncidentInput) -> tuple[float, float] | None:
    lat = incident.latitude
    lon = incident.longitude
    if lat is None or lon is None:
        return None
    if not math.isfinite(lat) or not math.isfinite(lon):
        return None
    return (lat, lon)


def _distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    _forward, _back, metres = _GEOD.inv(a[1], a[0], b[1], b[0])
    return float(metres)


def neighbor_counts(sites: list[tuple[tuple[float, float], int]]) -> dict[tuple[float, float], int]:
    """n per site. sites is (coordinate, multiplicity)."""
    counts: dict[tuple[float, float], int] = {}
    for index, (coord, multiplicity) in enumerate(sites):
        n = 1 if multiplicity >= 2 else 0
        for other_index, (other, _multiplicity) in enumerate(sites):
            if other_index == index:
                continue
            if _distance_m(coord, other) < RADIUS_M:
                n += 1
        counts[coord] = n
    return counts


def score_incidents(
    incidents: list[IncidentInput],
    as_of: date = AS_OF,
) -> list[ScoredIncident]:
    grouped: dict[tuple[float, float], list[IncidentInput]] = defaultdict(list)
    for incident in incidents:
        key = _coordinates(incident)
        if key is not None:
            grouped[key].append(incident)

    sites = [(coord, len(members)) for coord, members in grouped.items()]
    counts = neighbor_counts(sites)

    scored: list[ScoredIncident] = []
    for incident in incidents:
        recency = recency_factor(incident.reported, as_of)
        inspection = never_inspected_factor(incident.never_inspected)
        key = _coordinates(incident)
        if key is None:
            n = 0
            nearby = 1.0
            missing = True
        else:
            n = counts[key]
            nearby = nearby_factor(n)
            missing = False
        scored.append(
            ScoredIncident(
                incident_id=incident.incident_id,
                recency=recency,
                n=n,
                nearby=nearby,
                never_inspected=incident.never_inspected,
                never_inspected_factor=inspection,
                likelihood=likelihood_level(incident.reported, n, incident.never_inspected, as_of),
                routine_program_inspection=incident.routine_program_inspection,
                closed_date_blank=incident.closed_date_blank,
                coordinates_missing=missing,
            )
        )
    return scored

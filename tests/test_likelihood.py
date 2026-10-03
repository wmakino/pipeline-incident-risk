"""Likelihood contract. Synthetic points only. No CER file counts."""

from datetime import date, timedelta

import pytest
from pyproj import Geod

from likelihood import (
    IncidentInput,
    likelihood_level,
    nearby_factor,
    recency_factor,
    score_incidents,
)

AS_OF = date(2026, 9, 25)
GEOD = Geod(ellps="WGS84")
HOME = (51.0, -114.0)


def offset(lat: float, lon: float, bearing_deg: float, metres: float) -> tuple[float, float]:
    lon2, lat2, _back = GEOD.fwd(lon, lat, bearing_deg, metres)
    return lat2, lon2


def incident(
    incident_id: str,
    reported: date = AS_OF,
    latitude: float | None = HOME[0],
    longitude: float | None = HOME[1],
    never_inspected: bool = False,
    routine_program_inspection: bool = False,
    closed_date_blank: bool = False,
) -> IncidentInput:
    return IncidentInput(
        incident_id=incident_id,
        reported=reported,
        latitude=latitude,
        longitude=longitude,
        never_inspected=never_inspected,
        routine_program_inspection=routine_program_inspection,
        closed_date_blank=closed_date_blank,
    )


def test_report_on_as_of_date_has_recency_1():
    assert recency_factor(AS_OF, AS_OF) == 1.0


def test_recency_uses_day_count_over_365_25():
    reported = date(2025, 9, 25)
    days = (AS_OF - reported).days
    assert recency_factor(reported, AS_OF) == pytest.approx(1.0 / (1.0 + days / 365.25))


def test_reported_date_after_as_of_clamps_to_recency_1():
    assert recency_factor(date(2026, 9, 26), AS_OF) == 1.0


def test_nearby_starts_at_1_and_approaches_2():
    assert nearby_factor(0) == 1.0
    assert nearby_factor(1) == 1.5
    assert nearby_factor(3) == pytest.approx(1.75)
    assert nearby_factor(100) == pytest.approx(1.0 + 100 / 101)
    assert nearby_factor(100) < 2.0


# --- The 1-5 table ---------------------------------------------------------


def test_base_level_is_4_under_1_year():
    reported = AS_OF - timedelta(days=365)
    assert likelihood_level(reported, n=0, never_inspected=False) == 4


def test_base_level_drops_to_3_at_1_year():
    reported = AS_OF - timedelta(days=366)
    assert likelihood_level(reported, n=0, never_inspected=False) == 3


def test_base_level_stays_3_just_under_3_years():
    reported = AS_OF - timedelta(days=1095)
    assert likelihood_level(reported, n=0, never_inspected=False) == 3


def test_base_level_drops_to_1_at_3_years():
    reported = AS_OF - timedelta(days=1096)
    assert likelihood_level(reported, n=0, never_inspected=False) == 1


def test_neighbor_step_adds_one():
    reported = AS_OF - timedelta(days=1096)
    assert likelihood_level(reported, n=1, never_inspected=False) == 2


def test_never_inspected_step_adds_one():
    reported = AS_OF - timedelta(days=1096)
    assert likelihood_level(reported, n=0, never_inspected=True) == 2


def test_both_steps_on_an_old_isolate_reach_3():
    reported = AS_OF - timedelta(days=1096)
    assert likelihood_level(reported, n=1, never_inspected=True) == 3


def test_level_caps_at_5():
    assert likelihood_level(AS_OF, n=5, never_inspected=True) == 5


def test_fresh_report_with_no_steps_is_4():
    assert likelihood_level(AS_OF, n=0, never_inspected=False) == 4


# --- Scoring the record ----------------------------------------------------


def test_lone_incident_scores_level_4_and_keeps_factors():
    scored = score_incidents([incident("only")])
    assert scored[0].n == 0
    assert scored[0].nearby == 1.0
    assert scored[0].coordinates_missing is False
    assert scored[0].likelihood == 4


def test_exact_coordinate_pile_counts_as_one_neighbor():
    rows = [incident("a"), incident("b"), incident("c")]
    scored = score_incidents(rows)
    assert [row.n for row in scored] == [1, 1, 1]
    assert [row.nearby for row in scored] == pytest.approx([1.5, 1.5, 1.5])
    assert [row.likelihood for row in scored] == [5, 5, 5]


def test_other_site_under_100_m_counts_once():
    lat, lon = offset(HOME[0], HOME[1], 0, 50)
    scored = score_incidents([incident("home"), incident("near", latitude=lat, longitude=lon)])
    assert [row.n for row in scored] == [1, 1]
    assert scored[0].nearby == pytest.approx(1.5)


def test_site_at_99_m_counts_and_site_at_101_m_does_not():
    inside = offset(HOME[0], HOME[1], 0, 99)
    outside = offset(HOME[0], HOME[1], 90, 101)
    scored = score_incidents(
        [
            incident("home"),
            incident("in", latitude=inside[0], longitude=inside[1]),
            incident("out", latitude=outside[0], longitude=outside[1]),
        ]
    )
    by_id = {row.incident_id: row for row in scored}
    assert by_id["home"].n == 1
    assert by_id["in"].n == 1
    assert by_id["out"].n == 0
    assert by_id["out"].nearby == 1.0


def test_pile_plus_other_site_adds_both():
    lat, lon = offset(HOME[0], HOME[1], 180, 40)
    scored = score_incidents(
        [
            incident("pile-1"),
            incident("pile-2"),
            incident("other", latitude=lat, longitude=lon),
        ]
    )
    by_id = {row.incident_id: row for row in scored}
    assert by_id["pile-1"].n == 2
    assert by_id["other"].n == 1
    assert by_id["pile-1"].nearby == pytest.approx(1.0 + 2 / 3)


def test_two_other_sites_each_add_one():
    north = offset(HOME[0], HOME[1], 0, 40)
    east = offset(HOME[0], HOME[1], 90, 60)
    scored = score_incidents(
        [
            incident("home"),
            incident("north", latitude=north[0], longitude=north[1]),
            incident("east", latitude=east[0], longitude=east[1]),
        ]
    )
    by_id = {row.incident_id: row for row in scored}
    assert by_id["home"].n == 2
    assert by_id["north"].n == 2
    assert by_id["east"].n == 2


def test_closed_incident_stays_in_the_site_count():
    alone = score_incidents([incident("open", closed_date_blank=True)])
    with_closed = score_incidents(
        [
            incident("open", closed_date_blank=True),
            incident("closed", closed_date_blank=False),
        ]
    )
    assert alone[0].n == 0
    assert {row.incident_id: row.n for row in with_closed} == {"open": 1, "closed": 1}


def test_never_inspected_yes_raises_the_level_by_one_step():
    old = AS_OF - timedelta(days=1096)
    scored = score_incidents(
        [
            incident("no", reported=old, latitude=None, longitude=None, never_inspected=False),
            incident("yes", reported=old, latitude=None, longitude=None, never_inspected=True),
        ]
    )
    by_id = {row.incident_id: row for row in scored}
    assert by_id["no"].never_inspected_factor == 1.0
    assert by_id["yes"].never_inspected_factor == 1.5
    # Old isolate base 1. Never inspected adds one step.
    assert by_id["no"].likelihood == 1
    assert by_id["yes"].likelihood == 2


def test_same_site_rows_can_differ_by_recency_and_inspection():
    old = AS_OF - timedelta(days=1096)
    scored = score_incidents(
        [
            incident("new", reported=AS_OF, never_inspected=False),
            incident("old", reported=old, never_inspected=False),
        ]
    )
    by_id = {row.incident_id: row for row in scored}
    assert by_id["new"].n == by_id["old"].n == 1
    # new: base 4 + neighbor = 5. old: base 1 + neighbor = 2.
    assert by_id["new"].likelihood == 5
    assert by_id["old"].likelihood == 2
    assert by_id["old"].likelihood < by_id["new"].likelihood


def test_routine_and_closed_flags_do_not_change_the_level():
    base = incident("base")
    flipped = incident(
        "flipped",
        routine_program_inspection=True,
        closed_date_blank=True,
    )
    scored = score_incidents([base, flipped])
    assert scored[0].likelihood == scored[1].likelihood
    assert scored[1].routine_program_inspection is True
    assert scored[1].closed_date_blank is True
    assert scored[0].routine_program_inspection is False
    assert scored[0].closed_date_blank is False


def test_missing_coordinate_scores_as_no_neighbor_and_stays_in_the_list():
    old = AS_OF - timedelta(days=1096)
    scored = score_incidents(
        [
            incident("placed", reported=old),
            incident("blank", reported=old, latitude=None, longitude=None),
            incident("nan", reported=old, latitude=float("nan"), longitude=HOME[1]),
        ]
    )
    assert [row.incident_id for row in scored] == ["placed", "blank", "nan"]
    assert scored[1].coordinates_missing is True
    assert scored[1].n == 0
    assert scored[1].nearby == 1.0
    assert scored[1].likelihood == 1
    assert scored[2].coordinates_missing is True
    assert scored[0].n == 0


def test_likelihood_is_an_integer_from_1_to_5():
    lat, lon = offset(HOME[0], HOME[1], 45, 25)
    scored = score_incidents(
        [
            incident("pile", never_inspected=True),
            incident("mate"),
            incident("near", reported=date(2024, 9, 25), latitude=lat, longitude=lon),
        ]
    )
    for row in scored:
        assert isinstance(row.likelihood, int)
        assert 1 <= row.likelihood <= 5


def test_empty_input_returns_empty_list():
    assert score_incidents([]) == []

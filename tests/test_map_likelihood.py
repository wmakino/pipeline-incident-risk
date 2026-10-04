"""Map data for likelihood. Synthetic rows, plus the CER file when it is present."""

from datetime import date
from pathlib import Path

import pytest

from likelihood import score_incidents
from map_likelihood import (
    LEVEL_NAMES,
    CerIncident,
    level_color,
    likelihood_color,
    load_cer_incidents,
)

ROOT = Path(__file__).parents[1]
CER_PATH = ROOT / "data" / "pipeline-incidents-comprehensive-data.csv"
CER_SHA256 = "4700390576b6673cd9ac8f31781356e74855ce572900639a529e530a64bc90e0"


def row(
    incident_id: str,
    reported: date,
    latitude: float | None,
    longitude: float | None,
    never_inspected: bool = False,
    routine: bool = False,
    closed_blank: bool = False,
    company: str = "Example Pipe",
    province: str = "Alberta",
) -> CerIncident:
    from likelihood import IncidentInput

    return CerIncident(
        incident=IncidentInput(
            incident_id=incident_id,
            reported=reported,
            latitude=latitude,
            longitude=longitude,
            never_inspected=never_inspected,
            routine_program_inspection=routine,
            closed_date_blank=closed_blank,
        ),
        company=company,
        province=province,
    )


def test_color_runs_from_blue_to_red():
    low = likelihood_color(0.0)
    mid = likelihood_color(0.5)
    high = likelihood_color(1.0)
    assert low != high
    assert mid not in {low, high}

    def channel(hex_color: str, index: int) -> int:
        return int(hex_color[1 + index * 2 : 3 + index * 2], 16)

    assert channel(low, 2) > channel(high, 2)
    assert channel(high, 0) > channel(low, 0)
    assert channel(mid, 0) > channel(low, 0)
    assert channel(mid, 1) > channel(high, 1)


def test_level_color_is_five_fixed_steps_from_blue_to_red():
    colors = [level_color(level) for level in range(1, 6)]
    assert len(set(colors)) == 5
    assert colors[0] == likelihood_color(0.0)
    assert colors[4] == likelihood_color(1.0)

    def red(hex_color: str) -> int:
        return int(hex_color[1:3], 16)

    assert red(colors[4]) > red(colors[0])


def test_level_names_cover_1_to_5():
    assert LEVEL_NAMES[1] == "Very low"
    assert LEVEL_NAMES[5] == "Very high"
    assert set(LEVEL_NAMES) == {1, 2, 3, 4, 5}


def test_map_files_plot_located_incidents_only(tmp_path):
    import json

    from map_likelihood import write_incidents_json

    incidents = [
        row("INC-A", date(2026, 9, 25), 51.0, -114.0, company="North & West"),
        row("INC-B", date(2026, 9, 25), 53.5, -113.5, never_inspected=True),
        row("INC-C", date(2017, 1, 2), None, None),
    ]
    scored = score_incidents([item.incident for item in incidents])
    write_incidents_json(tmp_path / "incidents.json", incidents, scored)

    payload = json.loads((tmp_path / "incidents.json").read_text(encoding="utf-8"))
    features = payload["features"]
    by_id = {feature["properties"]["incident_id"]: feature["properties"] for feature in features}

    assert set(by_id) == {"INC-A", "INC-B"}
    assert by_id["INC-A"]["company"] == "North & West"
    # INC-A fresh isolate = 4. INC-B fresh isolate, never inspected = 5.
    assert by_id["INC-A"]["likelihood"] == 4
    assert by_id["INC-B"]["likelihood"] == 5
    assert by_id["INC-A"]["color"] == level_color(4)
    assert by_id["INC-B"]["color"] == level_color(5)
    assert "savings" not in (tmp_path / "incidents.json").read_text(encoding="utf-8").lower()


def test_loader_reads_yes_no_flags_and_blank_closed_date(tmp_path: Path):
    path = tmp_path / "incidents.csv"
    path.write_text(
        "\n".join(
            [
                "Incident Number,Reported Date,Latitude,Longitude,Closed Date,Province,Company,Equipment or component has never been inspected,Most recent inspection part of the routine inspection program",
                "INC-1,09/25/2026,51.0,-114.0,,Alberta,Example,No,Yes",
                "INC-2,01/02/2008,53.5,-113.5,06/01/2008,Alberta,Example,Yes,No",
            ]
        ),
        encoding="cp1252",
    )
    loaded = load_cer_incidents(path)
    assert loaded[0].incident.incident_id == "INC-1"
    assert loaded[0].incident.reported == date(2026, 9, 25)
    assert loaded[0].incident.closed_date_blank is True
    assert loaded[0].incident.never_inspected is False
    assert loaded[0].incident.routine_program_inspection is True
    assert loaded[0].company == "Example"
    assert loaded[0].province == "Alberta"
    assert loaded[1].incident.never_inspected is True
    assert loaded[1].incident.closed_date_blank is False
    assert loaded[1].incident.reported == date(2008, 1, 2)


def test_loader_rejects_an_unexpected_inspection_flag(tmp_path: Path):
    path = tmp_path / "incidents.csv"
    path.write_text(
        "\n".join(
            [
                "Incident Number,Reported Date,Latitude,Longitude,Closed Date,Province,Company,Equipment or component has never been inspected,Most recent inspection part of the routine inspection program",
                "INC-1,09/25/2026,51.0,-114.0,,Alberta,Example,Maybe,No",
            ]
        ),
        encoding="cp1252",
    )
    with pytest.raises(ValueError, match="INC-1"):
        load_cer_incidents(path)


@pytest.mark.skipif(not CER_PATH.exists(), reason="CER file is not downloaded")
def test_cer_file_matches_the_locked_likelihood_inputs():
    import hashlib

    digest = hashlib.sha256(CER_PATH.read_bytes()).hexdigest()
    assert digest == CER_SHA256

    loaded = load_cer_incidents(CER_PATH)
    scored = score_incidents([item.incident for item in loaded])
    assert len(loaded) == 2034
    assert sum(item.incident.never_inspected for item in loaded) == 112
    assert sum(item.incident.routine_program_inspection for item in loaded) == 309
    assert sum(item.incident.closed_date_blank for item in loaded) == 32
    assert min(item.incident.reported for item in loaded) == date(2008, 1, 2)
    assert max(item.incident.reported for item in loaded) == date(2026, 9, 25)
    assert all(item.coordinates_missing is False for item in scored)
    assert all(isinstance(item.likelihood, int) for item in scored)
    assert {item.likelihood for item in scored} <= {1, 2, 3, 4, 5}
    assert min(item.likelihood for item in scored) == 1
    assert max(item.likelihood for item in scored) == 5

"""Load CER incident rows and write the GeoJSON the dashboard map reads."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

from consequence import (
    CONSEQUENCE_NAMES,
    category_step,
    consequence_level,
    boscem_level,
    elevated_density,
    incident_boscem_cost,
    parse_volume,
    risk_product,
)
from aquifer import get_aquifer_vulnerability
from likelihood import IncidentInput, ScoredIncident

NEVER_COL = "Equipment or component has never been inspected"
ROUTINE_COL = "Most recent inspection part of the routine inspection program"

_BLUE = (0x2C, 0x7B, 0xB6)
_YELLOW = (0xFE, 0xE0, 0x90)
_RED = (0xD7, 0x19, 0x1C)

LEVEL_NAMES = {
    1: "Very low",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Very high",
}


@dataclass(frozen=True)
class CerIncident:
    incident: IncidentInput
    company: str
    province: str
    release_type: str = ""
    approximate_volume: str = ""
    population_density: str = ""
    what_happened_category: str = ""
    why_it_happened_category: str = ""
    nearest_populated_centre: str = ""
    substance: str = ""
    land_use: str = ""
    interruption: str = ""


def _mix(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> str:
    channels = [round(start[index] + (end[index] - start[index]) * t) for index in range(3)]
    return "#" + "".join(f"{channel:02x}" for channel in channels)


def likelihood_color(t: float) -> str:
    """Map 0..1 from blue through yellow to red. Low is blue, high is red."""
    clamped = 0.0 if t < 0 else 1.0 if t > 1 else t
    if clamped <= 0.5:
        return _mix(_BLUE, _YELLOW, clamped / 0.5)
    return _mix(_YELLOW, _RED, (clamped - 0.5) / 0.5)


def level_color(level: int) -> str:
    """One of five fixed steps on the ramp, chosen by the 1-5 level."""
    return likelihood_color((level - 1) / 4)


def _yes_no(value: str, incident_id: str, column: str) -> bool:
    text = value.strip()
    if text == "Yes":
        return True
    if text == "No":
        return False
    raise ValueError(f"{incident_id}: {column} is {value!r}")


def _coordinate(value: str) -> float | None:
    text = value.strip()
    if text == "":
        return None
    return float(text)


# MotherDuck stores the CER headers as snake_case. These are the columns the scorer reads.
RAW_COLUMNS = (
    ("incident_number", "Incident Number"),
    ("reported_date", "Reported Date"),
    ("latitude", "Latitude"),
    ("longitude", "Longitude"),
    ("closed_date", "Closed Date"),
    ("province", "Province"),
    ("company", "Company"),
    ("equipment_or_component_has_never_been_inspected", NEVER_COL),
    ("most_recent_inspection_part_of_the_routine_inspection_program", ROUTINE_COL),
    ("release_type", "Release Type"),
    ("approximate_volume_released_m3", "Approximate Volume Released (m3)"),
    ("population_density", "Population Density"),
    ("what_happened_category", "What happened category"),
    ("why_it_happened_category", "Why it happened category"),
    ("nearest_populated_centre", "Nearest Populated Centre"),
    ("substance", "Substance"),
    ("land_use", "Land Use"),
    ("duration_of_interruption_of_pipeline_operations", "Duration of interruption of pipeline operations"),
)


def load_cer_incidents(path: Path | str) -> list[CerIncident]:
    frame = pd.read_csv(path, encoding="cp1252", dtype=str, keep_default_na=False)
    return incidents_from_records(frame.to_dict(orient="records"))


def load_motherduck_incidents(connection: object) -> list[CerIncident]:
    projection = ", ".join(f'{column} AS "{label}"' for column, label in RAW_COLUMNS)
    frame = connection.execute(f"SELECT {projection} FROM raw_incidents").df()  # type: ignore[attr-defined]
    records = frame.fillna("").astype(str).to_dict(orient="records")
    return incidents_from_records(records)


def incidents_from_records(records: list[dict[str, str]]) -> list[CerIncident]:
    loaded: list[CerIncident] = []
    for record in records:
        incident_id = record["Incident Number"].strip()
        reported = _parse_mdy(record["Reported Date"].strip(), incident_id)
        loaded.append(
            CerIncident(
                incident=IncidentInput(
                    incident_id=incident_id,
                    reported=reported,
                    latitude=_coordinate(record["Latitude"]),
                    longitude=_coordinate(record["Longitude"]),
                    never_inspected=_yes_no(record[NEVER_COL], incident_id, NEVER_COL),
                    routine_program_inspection=_yes_no(
                        record[ROUTINE_COL], incident_id, ROUTINE_COL
                    ),
                    closed_date_blank=record["Closed Date"].strip() == "",
                ),
                company=record["Company"].strip(),
                province=record["Province"].strip(),
                release_type=record.get("Release Type", "").strip(),
                approximate_volume=record.get("Approximate Volume Released (m3)", "").strip(),
                population_density=record.get("Population Density", "").strip(),
                what_happened_category=record.get("What happened category", "").strip(),
                why_it_happened_category=record.get("Why it happened category", "").strip(),
                nearest_populated_centre=record.get("Nearest Populated Centre", "").strip(),
                substance=record.get("Substance", "").strip(),
                land_use=record.get("Land Use", "").strip(),
                interruption=record.get("Duration of interruption of pipeline operations", "").strip(),
            )
        )
    return loaded


def _parse_mdy(value: str, incident_id: str) -> date:
    pieces = value.split("/")
    if len(pieces) != 3:
        raise ValueError(f"{incident_id}: Reported Date is {value!r}")
    month, day, year = (int(piece) for piece in pieces)
    return date(year, month, day)


def incident_features(
    incidents: list[CerIncident],
    scored: list[ScoredIncident],
) -> list[dict[str, object]]:
    if len(incidents) != len(scored):
        raise ValueError("score count does not match incidents")

    located: list[tuple[CerIncident, ScoredIncident]] = []
    for incident, score in zip(incidents, scored, strict=True):
        if score.coordinates_missing:
            continue
        if score.incident_id != incident.incident.incident_id:
            raise ValueError("score order does not match incidents")
        located.append((incident, score))

    if not located:
        raise ValueError("no incidents with coordinates to map")

    located.sort(key=lambda pair: pair[1].likelihood)

    features: list[dict[str, object]] = []
    for incident, score in located:
        level = score.likelihood
        consequence = consequence_level(
            incident.release_type,
            incident.approximate_volume,
            incident.population_density,
            incident.what_happened_category,
            incident.why_it_happened_category,
            incident.substance,
            incident.land_use,
            incident.interruption,
        )
        boscem = incident_boscem_cost(
            incident.release_type,
            incident.approximate_volume,
            incident.substance,
            incident.land_use,
        )
        avi_index, avi_status = get_aquifer_vulnerability(
            incident.incident.latitude,
            incident.incident.longitude,
        )
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [incident.incident.longitude, incident.incident.latitude],
                },
                "properties": {
                    "incident_id": score.incident_id,
                    "reported": incident.incident.reported.isoformat(),
                    "company": incident.company,
                    "province": incident.province,
                    "recency": score.recency,
                    "n": score.n,
                    "nearby": score.nearby,
                    "never_inspected": "Yes" if score.never_inspected else "No",
                    "never_inspected_factor": score.never_inspected_factor,
                    "routine_program_inspection": (
                        "Yes" if score.routine_program_inspection else "No"
                    ),
                    "closed_date_blank": score.closed_date_blank,
                    "likelihood": level,
                    "level_name": LEVEL_NAMES[level],
                    "color": level_color(level),
                    "radius": 4 + (level - 1) / 4 * 5,
                    "consequence": consequence,
                    "consequence_name": CONSEQUENCE_NAMES[consequence] if consequence else "",
                    "risk": risk_product(level, consequence),
                    "release_type": incident.release_type,
                    "volume_m3": parse_volume(incident.approximate_volume),
                    "substance": incident.substance,
                    "land_use": incident.land_use,
                    "boscem_cost": boscem,
                    "boscem_level": boscem_level(boscem),
                    "population_density": incident.population_density,
                    "nearest_populated_centre": incident.nearest_populated_centre,
                    "elevated_density": elevated_density(incident.population_density),
                    "category_step": category_step(
                        incident.what_happened_category,
                        incident.why_it_happened_category,
                    ),
                    "interruption": incident.interruption,
                    "avi_index": avi_index,
                    "avi_status": avi_status,
                },
            }
        )
    return features


def write_incidents_json(
    path: Path | str,
    incidents: list[CerIncident],
    scored: list[ScoredIncident],
) -> Path:
    features = incident_features(incidents, scored)
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    return destination

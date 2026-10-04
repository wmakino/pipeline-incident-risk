"""MotherDuck connection for the pipeline_incident_ai database."""

from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb
import pandas as pd

DATABASE = "pipeline_incident_ai"
_ENV = Path(__file__).resolve().parent / ".env"


def motherduck_token() -> str:
    token = os.environ.get("MOTHERDUCK_TOKEN", "").strip()
    if token:
        return token
    if _ENV.exists():
        for line in _ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("MOTHERDUCK_TOKEN="):
                token = line.split("=", 1)[1].strip()
                if token:
                    os.environ["MOTHERDUCK_TOKEN"] = token
                    return token
    raise RuntimeError("MOTHERDUCK_TOKEN is not set")


def connect() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(
        f"md:{DATABASE}",
        config={"motherduck_token": motherduck_token()},
    )


def _scored_level(score: object, status: object) -> int | None:
    if status != "scored" or isinstance(score, bool) or not isinstance(score, (int, float)):
        return None
    level = int(score)
    if level != score or not 1 <= level <= 5:
        return None
    return level


def load_scored_models(connection: duckdb.DuckDBPyConnection) -> dict[str, tuple[int | None, int | None]]:
    """Criticality and groundwater levels that were actually scored, keyed by incident."""
    criticality = {
        str(incident_id): _scored_level(score, status)
        for incident_id, score, status in connection.execute(
            "SELECT incident_number, criticality_score, status FROM criticality_output"
        ).fetchall()
    }
    groundwater = {
        str(incident_id): _scored_level(score, status)
        for incident_id, score, status in connection.execute(
            "SELECT incident_number, groundwater_impact_score, status FROM groundwater_output"
        ).fetchall()
    }
    incident_ids = set(criticality) | set(groundwater)
    return {
        incident_id: (criticality.get(incident_id), groundwater.get(incident_id))
        for incident_id in incident_ids
        if criticality.get(incident_id) is not None or groundwater.get(incident_id) is not None
    }


def update_incident_consequences(
    connection: duckdb.DuckDBPyConnection,
    rows: list[tuple[str, int, int | None, int | None]],
) -> None:
    """Write likelihood, the folded consequence, and their product onto incident_scores."""
    connection.execute(
        """
        CREATE TEMP TABLE incoming_consequences (
            incident_number VARCHAR,
            likelihood INTEGER,
            consequence INTEGER,
            risk INTEGER
        )
        """
    )
    connection.executemany("INSERT INTO incoming_consequences VALUES (?, ?, ?, ?)", rows)
    connection.execute(
        """
        UPDATE incident_scores
        SET
            likelihood = incoming_consequences.likelihood,
            consequence = incoming_consequences.consequence,
            risk = incoming_consequences.risk,
            scored_at = now()
        FROM incoming_consequences
        WHERE incident_scores.incident_number = incoming_consequences.incident_number
        """
    )


def replace_map_features(connection: duckdb.DuckDBPyConnection, features: list[dict[str, object]]) -> int:
    """Replace the scored map. Each feature is the GeoJSON object the dashboard draws."""
    criticality = {
        incident_id: (score, status)
        for incident_id, score, status in connection.execute(
            "SELECT incident_number, criticality_score, status FROM criticality_output"
        ).fetchall()
    }
    groundwater = {
        incident_id: (score, status)
        for incident_id, score, status in connection.execute(
            "SELECT incident_number, groundwater_impact_score, status FROM groundwater_output"
        ).fetchall()
    }
    rows: list[dict[str, str]] = []
    for feature in features:
        properties = feature["properties"]
        if not isinstance(properties, dict):
            raise TypeError("feature properties must be an object")
        incident_id = str(properties["incident_id"])
        crit = criticality.get(incident_id)
        ground = groundwater.get(incident_id)
        properties["criticality_score"] = crit[0] if crit else None
        properties["criticality_status"] = crit[1] if crit else ""
        properties["groundwater_impact_score"] = ground[0] if ground else None
        properties["groundwater_status"] = ground[1] if ground else ""
        rows.append({"incident_number": incident_id, "feature": json.dumps(feature, ensure_ascii=False)})

    frame = pd.DataFrame(rows)
    connection.register("incoming_map_features", frame)
    connection.execute(
        """
        CREATE OR REPLACE TABLE map_features AS
        SELECT incident_number, feature::JSON AS feature
        FROM incoming_map_features
        """
    )
    return len(rows)

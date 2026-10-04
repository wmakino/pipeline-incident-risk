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

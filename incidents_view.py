"""One MotherDuck view of every CER incident column plus the score tables."""

from __future__ import annotations

import duckdb

VIEW_SQL = """
CREATE OR REPLACE VIEW incidents AS
SELECT
    r.*,
    s.likelihood,
    s.consequence,
    s.risk,
    s.boscem_cost,
    s.boscem_level,
    s.consequence_base,
    s.elevated_density,
    s.category_step,
    s.recency,
    s.n,
    s.nearby,
    s.never_inspected_factor,
    s.scored_at AS scores_scored_at,
    c.criticality_score,
    c.reasoning AS criticality_reasoning,
    c.threat_category,
    c.confidence AS criticality_confidence,
    c.status AS criticality_status,
    c.scored_at AS criticality_scored_at,
    g.groundwater_impact_score,
    g.reasoning AS groundwater_reasoning,
    g.confidence AS groundwater_confidence,
    g.status AS groundwater_status,
    g.avi_index,
    g.avi_status,
    g.scored_at AS groundwater_scored_at
FROM raw_incidents r
LEFT JOIN incident_scores s USING (incident_number)
LEFT JOIN criticality_output c USING (incident_number)
LEFT JOIN groundwater_output g USING (incident_number)
"""


def apply_incidents_view(connection: duckdb.DuckDBPyConnection) -> None:
    connection.execute(VIEW_SQL)

"""The incidents view is one row per CER incident, with model columns renamed."""

import duckdb

from incidents_view import VIEW_SQL


def test_view_keeps_cer_status_and_renames_model_status():
    connection = duckdb.connect()
    connection.execute(
        """
        CREATE TABLE raw_incidents (
            incident_number VARCHAR,
            company VARCHAR,
            status VARCHAR
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE incident_scores (
            incident_number VARCHAR,
            likelihood INTEGER,
            consequence INTEGER,
            risk INTEGER,
            boscem_cost DOUBLE,
            boscem_level INTEGER,
            consequence_base VARCHAR,
            elevated_density BOOLEAN,
            category_step BOOLEAN,
            recency DOUBLE,
            n INTEGER,
            nearby DOUBLE,
            never_inspected_factor DOUBLE,
            scored_at TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE criticality_output (
            incident_number VARCHAR,
            criticality_score INTEGER,
            reasoning VARCHAR,
            threat_category VARCHAR,
            confidence DOUBLE,
            status VARCHAR,
            scored_at TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE groundwater_output (
            incident_number VARCHAR,
            groundwater_impact_score INTEGER,
            reasoning VARCHAR,
            confidence DOUBLE,
            status VARCHAR,
            avi_index INTEGER,
            avi_status VARCHAR,
            scored_at TIMESTAMP
        )
        """
    )
    connection.execute("INSERT INTO raw_incidents VALUES ('A-1', 'Pipe Co', 'Closed')")
    connection.execute(
        """
        INSERT INTO incident_scores VALUES (
            'A-1', 4, NULL, NULL, NULL, NULL, NULL, false, false, 0.5, 2, 0.25, 1.0, NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO criticality_output VALUES (
            'A-1', 3, 'wall loss', 'external corrosion', 0.8, 'scored', NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO groundwater_output VALUES (
            'A-1', NULL, NULL, NULL, 'insufficient_input', NULL, 'no_coverage', NULL
        )
        """
    )

    connection.execute(VIEW_SQL)
    row = connection.execute(
        """
        SELECT company, status, likelihood, consequence, risk,
               criticality_status, groundwater_status, threat_category
        FROM incidents
        """
    ).fetchone()

    assert row == ("Pipe Co", "Closed", 4, None, None, "scored", "insufficient_input", "external corrosion")


def test_view_keeps_an_incident_that_has_no_scores():
    connection = duckdb.connect()
    connection.execute("CREATE TABLE raw_incidents (incident_number VARCHAR, company VARCHAR)")
    connection.execute(
        """
        CREATE TABLE incident_scores (
            incident_number VARCHAR, likelihood INTEGER, consequence INTEGER, risk INTEGER,
            boscem_cost DOUBLE, boscem_level INTEGER, consequence_base VARCHAR,
            elevated_density BOOLEAN, category_step BOOLEAN, recency DOUBLE, n INTEGER,
            nearby DOUBLE, never_inspected_factor DOUBLE, scored_at TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE criticality_output (
            incident_number VARCHAR, criticality_score INTEGER, reasoning VARCHAR,
            threat_category VARCHAR, confidence DOUBLE, status VARCHAR, scored_at TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE groundwater_output (
            incident_number VARCHAR, groundwater_impact_score INTEGER, reasoning VARCHAR,
            confidence DOUBLE, status VARCHAR, avi_index INTEGER, avi_status VARCHAR,
            scored_at TIMESTAMP
        )
        """
    )
    connection.execute("INSERT INTO raw_incidents VALUES ('B-2', 'Other Co')")
    connection.execute(VIEW_SQL)
    row = connection.execute(
        "SELECT company, likelihood, criticality_status, groundwater_status FROM incidents"
    ).fetchone()
    assert row == ("Other Co", None, None, None)

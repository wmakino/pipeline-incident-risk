"""Score MotherDuck incidents and store the map features there."""

from consequence import fold_model_scores, risk_product
from incidents_view import apply_incidents_view
from likelihood import score_incidents
from map_likelihood import incident_features, load_motherduck_incidents, release_consequence
from motherduck import connect, load_scored_models, replace_map_features, update_incident_consequences


def folded_consequences(loaded, scored, models):
    consequences: dict[str, int | None] = {}
    rows: list[tuple[str, int, int | None, int | None]] = []
    for item, score in zip(loaded, scored, strict=True):
        criticality, groundwater = models.get(score.incident_id, (None, None))
        consequence = fold_model_scores(release_consequence(item), criticality, groundwater)
        consequences[score.incident_id] = consequence
        rows.append((score.incident_id, score.likelihood, consequence, risk_product(score.likelihood, consequence)))
    return consequences, rows


def main() -> None:
    connection = connect()
    apply_incidents_view(connection)
    loaded = load_motherduck_incidents(connection)
    scored = score_incidents([item.incident for item in loaded])
    consequences, rows = folded_consequences(loaded, scored, load_scored_models(connection))
    count = replace_map_features(connection, incident_features(loaded, scored, consequences))
    update_incident_consequences(connection, rows)
    print(f"pipeline_incident_ai.map_features {count}")


if __name__ == "__main__":
    main()

"""Score MotherDuck incidents and store the map features there."""

from incidents_view import apply_incidents_view
from likelihood import score_incidents
from map_likelihood import incident_features, load_motherduck_incidents
from motherduck import connect, replace_map_features


def main() -> None:
    connection = connect()
    apply_incidents_view(connection)
    loaded = load_motherduck_incidents(connection)
    scored = score_incidents([item.incident for item in loaded])
    count = replace_map_features(connection, incident_features(loaded, scored))
    print(f"pipeline_incident_ai.map_features {count}")


if __name__ == "__main__":
    main()

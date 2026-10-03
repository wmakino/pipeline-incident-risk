"""Write scored incidents for the Next.js dashboard map."""

from pathlib import Path

from likelihood import score_incidents
from map_likelihood import load_cer_incidents, write_incidents_json

SOURCE = Path("data/pipeline-incidents-comprehensive-data.csv")
OUTPUT = Path("dashboard/public/incidents.json")


def main() -> None:
    loaded = load_cer_incidents(SOURCE)
    scored = score_incidents([item.incident for item in loaded])
    path = write_incidents_json(OUTPUT, loaded, scored)
    print(path.resolve())


if __name__ == "__main__":
    main()

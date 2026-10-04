# Pipeline incident risk

A crew-stop rank for incidents in the Canada Energy Regulator pipeline incident file. Risk is likelihood times consequence, as of the file date 2026-09-25. It is the next place to look, not a repair design and not a certificate that a pipe is safe.

The map is a Next.js app. Circle color is the selected part of the score: likelihood, consequence, or risk. Blue is lower and red is higher. Gray means that incident has no consequence, so it has no risk.

## Run the map

```bash
cd dashboard
npm install
npm run dev
```

Open http://127.0.0.1:3000.

## Rebuild the scored list

Incidents live in MotherDuck, database `pipeline_incident_ai`. Put `MOTHERDUCK_TOKEN` in `.env` at the repo root. That file is not committed.

```bash
pip install -r requirements.txt
python build_map.py
pytest
```

`build_map.py` reads `raw_incidents`, scores each row, and writes `map_features`. The dashboard reads that table. A scored criticality and a scored groundwater impact count equally with the release inside consequence. A low reading cannot pull that level down. Risk is still likelihood times that consequence.

The source file is Canada Energy Regulator pipeline incident data, Open Government Licence – Canada: https://www.cer-rec.gc.ca/open/incident/pipeline-incidents-comprehensive-data.csv

`docs/likelihood-brackets.xlsx` is a picture of the likelihood table. It does not score a row.

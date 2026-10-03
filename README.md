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

```bash
pip install -r requirements.txt
python build_map.py
pytest
```

`build_map.py` reads `data/pipeline-incidents-comprehensive-data.csv` and writes `dashboard/public/incidents.json`.

The source file is Canada Energy Regulator pipeline incident data, Open Government Licence – Canada: https://www.cer-rec.gc.ca/open/incident/pipeline-incidents-comprehensive-data.csv

`docs/likelihood-brackets.xlsx` is a picture of the likelihood table. It does not score a row.

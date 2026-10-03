"""Draw one circle per incident, colored by that incident's likelihood."""

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
    elevated_density,
    parse_volume,
    risk_product,
)
from likelihood import AS_OF, IncidentInput, ScoredIncident

NEVER_COL = "Equipment or component has never been inspected"
ROUTINE_COL = "Most recent inspection part of the routine inspection program"

_BLUE = (0x2C, 0x7B, 0xB6)
_YELLOW = (0xFE, 0xE0, 0x90)
_RED = (0xD7, 0x19, 0x1C)

LEVEL_NAMES = {
    1: "Rare",
    2: "Unlikely",
    3: "Possible",
    4: "Likely",
    5: "Almost certain",
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


def load_cer_incidents(path: Path | str) -> list[CerIncident]:
    frame = pd.read_csv(path, encoding="cp1252", dtype=str, keep_default_na=False)
    loaded: list[CerIncident] = []
    for record in frame.to_dict(orient="records"):
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
            )
        )
    return loaded


def _parse_mdy(value: str, incident_id: str) -> date:
    pieces = value.split("/")
    if len(pieces) != 3:
        raise ValueError(f"{incident_id}: Reported Date is {value!r}")
    month, day, year = (int(piece) for piece in pieces)
    return date(year, month, day)


def _features(
    incidents: list[CerIncident],
    scored: list[ScoredIncident],
) -> tuple[list[dict[str, object]], int, int]:
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

    low = min(score.likelihood for _, score in located)
    high = max(score.likelihood for _, score in located)
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
                    "population_density": incident.population_density,
                    "nearest_populated_centre": incident.nearest_populated_centre,
                    "elevated_density": elevated_density(incident.population_density),
                    "category_step": category_step(
                        incident.what_happened_category,
                        incident.why_it_happened_category,
                    ),
                },
            }
        )
    return features, low, high


def write_incidents_json(
    path: Path | str,
    incidents: list[CerIncident],
    scored: list[ScoredIncident],
) -> Path:
    features, _low, _high = _features(incidents, scored)
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


def write_likelihood_map(
    directory: Path | str,
    incidents: list[CerIncident],
    scored: list[ScoredIncident],
    as_of: date = AS_OF,
) -> Path:
    folder = Path(directory)
    folder.mkdir(parents=True, exist_ok=True)
    features, _low, _high = _features(incidents, scored)
    reported_dates = [item.incident.reported for item in incidents]
    collection = {"type": "FeatureCollection", "features": features}
    (folder / "incidents.json").write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    html_path = folder / "likelihood.html"
    html_path.write_text(
        _html(
            plotted=len(features),
            first=min(reported_dates),
            last=max(reported_dates),
            as_of=as_of,
        ),
        encoding="utf-8",
    )
    return html_path


def _legend_rows() -> str:
    rows = []
    for level in range(5, 0, -1):
        rows.append(
            f'<li><span class="swatch" style="background: {level_color(level)}"></span>'
            f"{level} {LEVEL_NAMES[level]}</li>"
        )
    return "".join(rows)


def _html(*, plotted: int, first: date, last: date, as_of: date) -> str:
    return _PAGE.format(
        plotted=f"{plotted:,}",
        legend=_legend_rows(),
        as_of=as_of.isoformat(),
        first=first.isoformat(),
        last=last.isoformat(),
    )


_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Incident likelihood</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  :root {{
    --ink: #2a2420;
    --panel: #f6f3ee;
    --line: #d9d3c7;
    --muted: #5e564e;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ height: 100%; margin: 0; }}
  body {{
    display: grid;
    grid-template-columns: 300px 1fr;
    color: var(--ink);
    font-family: "Segoe UI", sans-serif;
    background: var(--panel);
  }}
  .panel {{
    padding: 22px 20px;
    border-right: 1px solid var(--line);
    overflow: auto;
  }}
  h1 {{
    margin: 0 0 8px;
    font-size: 22px;
    font-weight: 650;
    font-style: normal;
    letter-spacing: -0.02em;
  }}
  p {{ margin: 0 0 12px; font-size: 14px; line-height: 1.45; }}
  .formula {{ font-variant-numeric: tabular-nums; }}
  .muted {{ color: var(--muted); font-size: 13px; }}
  .legend {{
    list-style: none;
    margin: 14px 0;
    padding: 0;
    font-size: 13px;
  }}
  .legend li {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
  }}
  .swatch {{
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex: 0 0 auto;
  }}
  #map {{ height: 100%; min-height: 420px; background: #e7e2da; }}
  @media (max-width: 700px) {{
    body {{ grid-template-columns: 1fr; grid-template-rows: auto 1fr; }}
    .panel {{ border-right: 0; border-bottom: 1px solid var(--line); }}
  }}
</style>
</head>
<body>
  <aside class="panel">
    <h1>Incident likelihood</h1>
    <p class="formula">likelihood 1-5 = recency band, +1 nearby, +1 never inspected</p>
    <p>Each circle is one incident from the CER pipeline incident file. Color is that incident's likelihood level, 1 to 5, as of {as_of} (reported date). Blue is a lower level and red is a higher level. This is not a safety certificate and not a repair design. Consequence is not in this view.</p>
    <ul class="legend">{legend}</ul>
    <p class="muted">{plotted} incidents plotted. Reported {first} through {last}. Source: CER pipeline incidents comprehensive data.</p>
  </aside>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map("map");
    L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap"
    }}).addTo(map);

    function esc(value) {{
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }}

    function num(value) {{
      return Number(value).toFixed(3);
    }}

    fetch("incidents.json")
      .then((response) => {{
        if (!response.ok) throw new Error("incidents.json " + response.status);
        return response.json();
      }})
      .then((incidents) => {{
        const layer = L.geoJSON(incidents, {{
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {{
            radius: feature.properties.radius,
            color: feature.properties.color,
            fillColor: feature.properties.color,
            fillOpacity: 0.88,
            weight: 0.6,
            opacity: 1
          }}),
          onEachFeature: (feature, marker) => {{
            const item = feature.properties;
            const closed = item.closed_date_blank ? "Yes" : "No";
            marker.bindPopup(
              "<strong>" + esc(item.incident_id) + "</strong><br>"
              + esc(item.company) + " · " + esc(item.province) + "<br>"
              + "Reported " + esc(item.reported) + "<br>"
              + "Likelihood " + esc(item.likelihood) + " " + esc(item.level_name) + "<br>"
              + "Recency " + num(item.recency) + "<br>"
              + "Nearby " + num(item.nearby) + " (n=" + esc(item.n) + ")<br>"
              + "Never inspected " + esc(item.never_inspected) + "<br>"
              + "Routine program " + esc(item.routine_program_inspection) + "<br>"
              + "Closed date blank " + closed
            );
          }}
        }}).addTo(map);
        map.fitBounds(layer.getBounds(), {{ padding: [24, 24] }});
      }})
      .catch((error) => {{
        document.getElementById("map").textContent = "Could not load incidents.json. " + error;
      }});
  </script>
</body>
</html>
"""

# Pipeline lines on the likelihood map

The lines are context under the incident circles. They do not change the 1–5 likelihood. An incident stays a circle. Nothing is snapped to a line, and distance to a line is not a score term.

## What Government of Canada actually publishes

There is no Open Government Licence shapefile of every CER-regulated centreline.

Checked on 3 October 2026:

- The CER interactive map says the pipeline geometry on that map may not be reproduced, published, distributed, or transferred. Incident points on the same map are a separate open file, which this project already uses.
- The same CER ArcGIS organization does publish a queryable polyline layer, `CER_Pipeline_Systems_WGS84`, layer id 3, on `CER_Pipeline_Systems_WGS84_view`. It is WGS84, geometry type polyline, and it returned 28 features. Fields used here are `Pipeline_Name`, `Company`, and `Commodity`. The 28 names include NGTL System, Trans Mountain Pipeline, Keystone Pipeline, Enbridge Canadian Mainline, and the other named CER systems. This is a system schematic, not every licensed segment.
- Natural Resources Canada’s 2006 pipeline atlas is a raster. It is not a line layer.
- CanVec is an NRCan topographic series under the Open Government Licence. It is not the CER operating network. A sewage or liquid-waste pipeline attribute in that catalogue is not this layer.
- The only pipeline vectors on the federal Open Government portal that are a straightforward download are provincial. New Brunswick’s approximate centrelines are six multilines. They do not cover the national incident map.
- Alberta AER lines, including the copy hosted on the CER ArcGIS site as `AER_Regulated_Pipelines_v1`, are provincial. The AER extract used in earlier research is Alberta only and marked not-CER on every record. British Columbia and Saskatchewan centre-lines are provincial too.

## Decision

Draw the 28 CER system polylines, and add the provincial centre-lines that those systems leave out.

Saskatchewan licensed pipelines (not flowlines) and British Columbia permitted segments load in full. Alberta regulated pipelines load only for a close view, because that layer is about 315,000 segments. The browser requests them. The project does not store the geometry.

The CER systems are still one live GeoJSON request. A stored copy of that geometry would be the redistribution the CER page forbids. If a line request fails, the incident circles still draw.

CER query, GeoJSON, popup fields only:

`https://services5.arcgis.com/vNzamREXvX2WcX6d/ArcGIS/rest/services/CER_Pipeline_Systems_WGS84_view/FeatureServer/3/query?where=1%3D1&outFields=Pipeline_Name,Company,Commodity&f=geojson`

## How it looks

- Lines sit under the incident circles.
- One neutral blue-gray stroke, 2.5 pixels at `#31404d`, so the line stays visible at country scale and the likelihood color stays on the circles.
- A line popup names the pipeline, the company, and the commodity. It does not show a likelihood.
- The panel says the lines are CER pipeline systems, fetched for this view, not kept in the project, and not part of the score.
- The layer can be turned off. The default is on.

## Out of scope

- Scoring, nearby radius, and the 1–5 table.
- Snapping an incident to the nearest line.
- CanVec and the 2006 atlas image.
- Saskatchewan flowlines and a full download of the Alberta layer.
- A copy of the line geometry in `public/` or in git.

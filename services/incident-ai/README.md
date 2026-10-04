# Pipeline Incident AI Microservice

FastAPI microservice with two AI-backed endpoints feeding the Consequence side of the team's pipeline risk ranking algorithm (Case 10):
- `POST /api/v1/criticality/score` — classifies a pipeline incident's free-text description against the ASME B31.8S integrity threat taxonomy, returning a 1-5 criticality score.
- `POST /api/v1/groundwater/impact` — for liquid releases, assesses potential long-term groundwater impact using Alberta's Aquifer Vulnerability Index and the Source-Pathway-Receptor framework.

## Endpoint User Guide

### `POST /api/v1/criticality/score`

Also available: `GET /health` (liveness check, no inputs, no auth required, returns `{"status": "ok"}`).

Requires a static API key in the `X-API-Key` header — one fixed value, no expiry, no token exchange. Get the value from whoever deployed the service.

```bash
curl -s -X POST https://<your-render-url>.onrender.com/api/v1/criticality/score \
  -H "X-API-Key: <your api key>" \
  -H "Content-Type: application/json" \
  -d '{
    "detailed_what_happened": "External corrosion found during routine inspection.",
    "detailed_why_it_happened": "Coating degraded over fifteen years allowing moisture ingress.",
    "incident_id": "INC-001"
  }'
```

**Example response**
```json
{
  "criticality_score": 4,
  "reasoning": "The incident text explicitly mentions 'external corrosion', a time-dependent threat mechanism, and the basic cause describes a long-term degradation process over fifteen years, indicating a systemic issue.",
  "threat_category": "external corrosion",
  "confidence": 1.0,
  "status": "scored",
  "incident_id": "INC-001"
}
```

Optional fields are just additional keys in the same JSON body — no nesting, no special structure. Omit any you don't have:

```json
{
  "detailed_what_happened": "Substandard Acts, Failure to follow procedure or policy or practice",
  "detailed_why_it_happened": "Job or system factors, Inadequate communications, Inadequate communication of safety and health data, regulations or guidelines",
  "incident_id": "INC-002",
  "incident_types": "Fire, Release of Substance",
  "substance_carried": "Natural Gas Sour",
  "duration_of_interruption": "Long-term interruption",
  "emergency_level": "Level II"
}
```
```json
{
  "criticality_score": 5,
  "reasoning": "The incident text describes a failure to follow procedure or policy, which is a clear indication of an incorrect operational procedure. Additionally, the text mentions inadequate communication of safety and health data, regulations, or guidelines, which suggests a systemic management-system failure. The combination of these two factors, along with the severe consequences of the incident (fire, release of substance, and long-term interruption), justifies a criticality score of 5.",
  "threat_category": "incorrect operational procedure",
  "confidence": 0.9,
  "status": "scored",
  "incident_id": "INC-002"
}
```

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `detailed_what_happened` | string | yes | Free-text description of what happened. Max 4000 chars. |
| `detailed_why_it_happened` | string | yes | Free-text description of why it happened. Max 4000 chars. |
| `incident_id` | string \| null | no | Passthrough identifier, echoed back in the response. Max 200 chars. |
| `incident_types` | string \| null | no | Physical manifestation (e.g. "Fire"). Max 200 chars. |
| `substance_carried` | string \| null | no | What the pipeline was carrying. Max 300 chars. |
| `duration_of_interruption` | string \| null | no | Whether operations were disrupted. Max 100 chars. |
| `equipment_or_component_involved` | string \| null | no | What specifically broke. Max 500 chars. |
| `pipeline_outside_diameter_nps` | string \| null | no | Pipe outside diameter. Max 100 chars. |
| `nominal_pipe_size` | string \| null | no | Nominal pipe size. Max 50 chars. |
| `emergency_level` | string \| null | no | One of `"Not Emergency"`, `"Level I"`, `"Level II"`, `"Level III"`, `"Emergency"`. |

**Response body**

| Field | Type | Description |
|---|---|---|
| `criticality_score` | int, 1-5 | Severity value. 1 = negligible, 5 = critical. |
| `reasoning` | string | 1-2 sentence justification. |
| `threat_category` | string (enum) | One of the 9 ASME B31.8S categories, or `"Ambiguous"`. |
| `confidence` | float, 0-1 | Model's self-reported certainty — not a statistical probability. |
| `status` | string (enum) | `"scored"` (real AI result), `"insufficient_input"` (both text fields were blank), or `"ai_unavailable"` (AI call failed after retries — treat as unscored). |
| `incident_id` | string \| null | Echoes the request's `incident_id`. |

### `POST /api/v1/groundwater/impact`

For liquid releases only — assesses the potential long-term impact on groundwater using the Source-Pathway-Receptor framework (CCME's own model for petroleum-in-groundwater risk). **Source** is the substance/volume released; **Pathway** is Alberta's Aquifer Vulnerability Index (AVI), a 1km-resolution government raster; **Receptor/context** is land use and residual environmental effects. Same auth as `/criticality/score` — the `X-API-Key` header, no separate setup.

If `release_type` isn't `"Liquid"`, or no substance is given, the request short-circuits to `status="insufficient_input"` without calling the AI or looking up AVI — there's no groundwater pathway for this endpoint to assess.

```bash
curl -s -X POST https://<your-render-url>.onrender.com/api/v1/groundwater/impact \
  -H "X-API-Key: <your api key>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 53.54423100,
    "longitude": -113.34926900,
    "release_type": "Liquid",
    "released_substance_type": "Crude Oil - Synthetic",
    "released_volume_m3": 15.0,
    "land_use": "Agricultural Cropland",
    "residual_effects_on_environment": "Yes"
  }'
```

**Example response** (live-verified against the real model and the real AVI file)
```json
{
  "groundwater_impact_score": 3,
  "reasoning": "The incident involved a moderate volume of 15.0 cubic meters of synthetic crude oil, which is a mobile and somewhat soluble substance, over a pathway with moderate-low vulnerability (AVI index of 3), and there are confirmed residual environmental effects, contributing to a moderate long-term groundwater impact risk. The agricultural land use suggests plausible groundwater reliance and ecological sensitivity, further supporting this assessment.",
  "confidence": 0.8,
  "status": "scored",
  "avi_index": 3,
  "avi_status": "available",
  "incident_id": null
}
```

**What happens outside Alberta, or anywhere AVI has no data** — the coordinate is simply outside the raster's extent (every other province) or inside Alberta but never surveyed (e.g. Rocky Mountain terrain). This is **not** treated as a reason to skip the call or guess a low score — missing data isn't evidence of safety. The AI is told plainly that AVI data isn't available and instructed to apply a conservative default assumption, with the uncertainty reflected in a lower `confidence`, not a lower score:

```json
{
  "groundwater_impact_score": 3,
  "reasoning": "The released substance is Crude Oil - Sweet, which is a mobile and somewhat soluble substance, and the volume is moderate at 5.0 m3. Given the absence of AVI data, a conservative, moderate default assumption about pathway vulnerability is applied, leading to a moderate groundwater impact score.",
  "confidence": 0.6,
  "status": "scored",
  "avi_index": null,
  "avi_status": "no_coverage",
  "incident_id": null
}
```

**Why there's no StatCan geography dataset in this endpoint** — a Census Subdivision/Dissemination Area join was considered for receptor context (population density, rural/urban character) and deliberately not used. `Population Density` is already one of the structured Consequence side's own factors elsewhere in this project's algorithm — reusing it here would double-count the same signal. AVI's own raster bounds already distinguish "in Alberta" from "not," which was the only other thing a geography file would have added.

**Why Substance/Volume appear here even though another part of this project's algorithm also scores from them** — that other calculation asks "how hazardous is this substance in general," independent of location. This endpoint asks a different question: "given this substance/volume *combined with the measured vulnerability at this exact point*, what's the long-term groundwater risk?" Same substance/volume inputs, genuinely different question, not a duplicate signal — flagged here because it's a coordination point worth a conversation with whoever owns the structured Consequence side, not something to silently resolve alone.

**The AVI 1-6 band meaning is our own interpretation, not a published Alberta legend.** Checked the official metadata, a bundled KMZ (dead link — the government's own ArcGIS server's TLS cert had already expired), the live ArcGIS legend endpoint (same expired cert), and a federal open-data mirror — none published a numbered table. The direction used (`app/features/groundwater/prompts/system_prompt.md`) — higher = more vulnerable — is synthesized from the index's own methodology description plus two independently-documented Canadian conventions that both treat a higher vulnerability number as worse. Reasonable and evidence-grounded, not confirmed fact.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `latitude` | float | yes | Incident latitude, WGS84 decimal degrees. |
| `longitude` | float | yes | Incident longitude, WGS84 decimal degrees. |
| `release_type` | string (enum) | yes | One of `"Liquid"`, `"Gas"`, `"Miscellaneous"`, `"Not Applicable"`. Only `"Liquid"` is scored — anything else short-circuits to `insufficient_input`. |
| `released_substance_type` | string \| null | no | Category the released substance falls under. Max 100 chars. |
| `released_volume_m3` | float \| null | no | Approximate volume released, cubic metres. |
| `incident_type` | string \| null | no | Physical manifestation (e.g. "Fire") — same CER field/column already used as `incident_types` on the criticality endpoint. Max 200 chars. |
| `residual_effects_on_environment` | string \| null | no | Whether environmental effects remained after mitigation. Max 50 chars. |
| `land_use` | string \| null | no | Land use category at the incident location. Max 100 chars. |
| `incident_id` | string \| null | no | Passthrough identifier, echoed back in the response. Max 200 chars. |

**Response body**

| Field | Type | Description |
|---|---|---|
| `groundwater_impact_score` | int, 1-5 | Long-term groundwater impact severity. 1 = negligible, 5 = critical. |
| `reasoning` | string | 1-2 sentence justification. |
| `confidence` | float, 0-1 | Model's self-reported certainty. Lower when AVI data is unavailable or inputs are sparse. |
| `status` | string (enum) | `"scored"`, `"insufficient_input"` (not a liquid release, or no substance given), or `"ai_unavailable"` (AI call failed after retries). |
| `avi_index` | int (1-6) \| null | The raw AVI reading at this coordinate — a deterministic fact, not produced by the AI. `null` whenever `avi_status` is `"no_coverage"`. |
| `avi_status` | string (enum) | `"available"` or `"no_coverage"` — never a numeral standing in for missing data. |
| `incident_id` | string \| null | Echoes the request's `incident_id`. |

from typing import Literal

from pydantic import BaseModel, Field

MAX_INCIDENT_ID_LENGTH = 200
MAX_SUBSTANCE_TYPE_LENGTH = 100
MAX_INCIDENT_TYPE_LENGTH = 200
MAX_RESIDUAL_EFFECTS_LENGTH = 50
MAX_LAND_USE_LENGTH = 100

ReleaseType = Literal["Liquid", "Gas", "Miscellaneous", "Not Applicable"]
AVIStatus = Literal["available", "no_coverage"]


class GroundwaterImpactRequest(BaseModel):
    latitude: float = Field(description="Incident latitude, WGS84 decimal degrees.")
    longitude: float = Field(description="Incident longitude, WGS84 decimal degrees.")

    # CER official definition ("Release Type"): the release's physical state.
    # Used as a deterministic gate - a release that was never liquid has no
    # groundwater pathway for this endpoint to assess.
    release_type: ReleaseType = Field(
        description='CER "Release Type": the physical state of what was released '
        '("Liquid", "Gas", "Miscellaneous", or "Not Applicable" when nothing was '
        "released). Only Liquid releases are scored by this endpoint."
    )

    released_substance_type: str | None = Field(
        default=None,
        max_length=MAX_SUBSTANCE_TYPE_LENGTH,
        description='CER "Released Substance Type": the category the released substance '
        "falls under (e.g. a commodity, a High Vapour Pressure Product).",
    )
    released_volume_m3: float | None = Field(
        default=None,
        description='CER "Released volume (m3)": the approximate volume released, in '
        "cubic metres.",
    )
    # Same CER "Incident Type" column/definition already used as `incident_types`
    # on the criticality endpoint - the physical manifestation of the incident
    # (Fatality, Fire, Release of Substance, etc.), not a root cause.
    incident_type: str | None = Field(
        default=None,
        max_length=MAX_INCIDENT_TYPE_LENGTH,
        description='CER "Incident Type": "The type of incident(s) that occurred, which can '
        "be any of the following: Fatality, Serious Injury (NEB or TSB), Explosion, Fire, "
        'Release of Substance, Operation Beyond Design Limits, Adverse Environmental '
        'Effects."',
    )
    residual_effects_on_environment: str | None = Field(
        default=None,
        max_length=MAX_RESIDUAL_EFFECTS_LENGTH,
        description='CER "Residual effects on the environment": whether there are '
        "environmental effects remaining after mitigation has taken place.",
    )
    land_use: str | None = Field(
        default=None,
        max_length=MAX_LAND_USE_LENGTH,
        description='CER "Land Use": the category of land use at the incident location '
        "(e.g. agricultural cropland, forests, developed land).",
    )
    incident_id: str | None = Field(default=None, max_length=MAX_INCIDENT_ID_LENGTH)


class LLMGroundwaterOutput(BaseModel):
    """What we require the model itself to return."""

    groundwater_impact_score: int = Field(ge=1, le=5)
    reasoning: str
    confidence: float = Field(ge=0, le=1)


class GroundwaterImpactResponse(LLMGroundwaterOutput):
    """Public response contract for POST /groundwater/impact."""

    status: Literal["scored", "insufficient_input", "ai_unavailable"]
    # Deterministic facts set by this service, not produced by the LLM - kept
    # as their own fields (not folded into `reasoning` prose) so a caller can
    # audit the AVI reading independent of the model's judgment.
    avi_index: int | None = Field(default=None, ge=1, le=6)
    avi_status: AVIStatus
    incident_id: str | None = Field(default=None, max_length=MAX_INCIDENT_ID_LENGTH)

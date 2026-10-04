from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ThreatCategory(str, Enum):
    """ASME B31.8S §2.2 integrity threat categories, literal standard wording."""

    EXTERNAL_CORROSION = "external corrosion"
    INTERNAL_CORROSION = "internal corrosion"
    STRESS_CORROSION_CRACKING = "stress corrosion cracking"
    MANUFACTURING_RELATED_DEFECTS = "manufacturing-related defects"
    WELDING_FABRICATION_RELATED = "welding/fabrication related"
    EQUIPMENT_FAILURE = "equipment failure"
    THIRD_PARTY_MECHANICAL_DAMAGE = "third-party/mechanical damage"
    INCORRECT_OPERATIONAL_PROCEDURE = "incorrect operational procedure"
    WEATHER_RELATED_AND_OUTSIDE_FORCE = "weather-related and outside force"
    AMBIGUOUS = "Ambiguous"


MAX_FREE_TEXT_LENGTH = 4000
MAX_INCIDENT_ID_LENGTH = 200
MAX_INCIDENT_TYPES_LENGTH = 200
MAX_SUBSTANCE_CARRIED_LENGTH = 300
MAX_DURATION_LENGTH = 100
MAX_EQUIPMENT_LENGTH = 500
MAX_PIPE_DIAMETER_LENGTH = 100
MAX_PIPE_SIZE_LENGTH = 50


class CriticalityRequest(BaseModel):
    # CER official definition ("Detailed immediate cause"): "The circumstances that
    # directly led to the occurrence of the incident. An incident may have more than
    # one immediate cause." (Our raw CSV export names this column "Detailed what
    # happened" — the dictionary uses "Detailed immediate cause"; same field, CER
    # appears to have renamed it for plain-language public release.)
    detailed_what_happened: str = Field(
        max_length=MAX_FREE_TEXT_LENGTH,
        description='CER "Detailed immediate cause" (exported as "Detailed what happened"): '
        '"The circumstances that directly led to the occurrence of the incident. An '
        'incident may have more than one immediate cause."',
    )
    # CER official definition ("Detailed basic cause"): "The underlying reasons behind
    # the immediate cause that explain why the immediate circumstances existed."
    detailed_why_it_happened: str = Field(
        max_length=MAX_FREE_TEXT_LENGTH,
        description='CER "Detailed basic cause" (exported as "Detailed why it happened"): '
        '"The underlying reasons behind the immediate cause that explain why the '
        'immediate circumstances existed."',
    )
    incident_id: str | None = Field(default=None, max_length=MAX_INCIDENT_ID_LENGTH)

    # Optional supporting context, not primary classification input:
    incident_types: str | None = Field(
        default=None,
        max_length=MAX_INCIDENT_TYPES_LENGTH,
        description='CER "Incident Type": "The type of incident(s) that occurred, which can '
        "be any of the following: Fatality, Serious Injury (NEB or TSB), Explosion, Fire, "
        'Release of Substance, Operation Beyond Design Limits, Adverse Environmental '
        'Effects." Given to the AI as extra context alongside the causal description.',
    )
    substance_carried: str | None = Field(
        default=None,
        max_length=MAX_SUBSTANCE_CARRIED_LENGTH,
        description='CER "Substance carried": "The substance carried by the pipeline." Not '
        "standardized enough for a deterministic lookup (free-ish combinations like "
        '"Condensate, Crude Oil, Natural Gas Liquids"), so given to the AI as context '
        'instead. Distinct from "Substance", which is already a structured consequence '
        "factor elsewhere in the algorithm.",
    )
    duration_of_interruption: str | None = Field(
        default=None,
        max_length=MAX_DURATION_LENGTH,
        description='CER "Duration of interruption of pipeline operations": "The duration '
        'of any interruption to the pipeline operations." Lets the AI factor in whether '
        "the incident actually disrupted operations.",
    )
    equipment_or_component_involved: str | None = Field(
        default=None,
        max_length=MAX_EQUIPMENT_LENGTH,
        description='CER "Equipment or Components involved": "The type of any equipment or '
        "components involved in the incident. Components in this case refer to a segment "
        "of the piping that is designed to maintain pipe pressure but is not the main "
        'body of the pipe, such as a pipe elbow or flange."',
    )
    pipeline_outside_diameter_nps: str | None = Field(
        default=None,
        max_length=MAX_PIPE_DIAMETER_LENGTH,
        description='CER "Pipeline outside diameter (NPS)": "The size of the outside '
        'diameter of the pipeline, according to the Nominal Pipe Size (NPS) standard of '
        'measurement." Included as a Consequence-side signal (scale of what could be '
        "released/affected), not a Likelihood one — unlike most of the asset-condition "
        "columns in this dataset (material, wall thickness, coating, cathodic "
        "protection), raw pipe size doesn't indicate failure probability, only "
        "potential impact scale.",
    )
    nominal_pipe_size: str | None = Field(
        default=None,
        max_length=MAX_PIPE_SIZE_LENGTH,
        description='CER "Nominal Pipe Size": "The size of the outside diameter of the pipe '
        'involved in the incident, according to the Nominal Pipe Size (NPS) standard of '
        'measurement." Near-identical official wording to pipeline_outside_diameter_nps '
        "— treat as the same scale signal, not two independent ones.",
    )
    emergency_level: Literal["Not Emergency", "Level I", "Level II", "Level III", "Emergency"] | None = Field(
        default=None,
        description='CER "Emergency Level": "The level of emergency (on a scale of 1 to 3, '
        "with 3 being the most severe or hazardous) determined based on the level of "
        'severity of the incident and the potential hazards to the public and the '
        'environment." Given to the AI as context (like duration_of_interruption), not an '
        "external cap — CER assigns this to every incident, not just significant ones, so "
        'it carries real severity signal without the "suppresses not-yet-catastrophic '
        'threats" problem significant=No had (see README/PROJECT_NOTES for why the '
        "significant-based cap was removed).",
    )


class LLMCriticalityOutput(BaseModel):
    """What we require the model itself to return."""

    criticality_score: int = Field(ge=1, le=5)
    reasoning: str
    threat_category: ThreatCategory
    confidence: float = Field(ge=0, le=1)


class CriticalityResponse(LLMCriticalityOutput):
    """Public response contract for POST /criticality/score."""

    status: Literal["scored", "insufficient_input", "ai_unavailable"]
    incident_id: str | None = Field(default=None, max_length=MAX_INCIDENT_ID_LENGTH)

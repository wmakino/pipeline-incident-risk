import pytest
from pydantic import ValidationError

from app.features.criticality.schemas import (
    MAX_DURATION_LENGTH,
    MAX_EQUIPMENT_LENGTH,
    MAX_FREE_TEXT_LENGTH,
    MAX_INCIDENT_ID_LENGTH,
    MAX_INCIDENT_TYPES_LENGTH,
    MAX_PIPE_DIAMETER_LENGTH,
    MAX_PIPE_SIZE_LENGTH,
    MAX_SUBSTANCE_CARRIED_LENGTH,
    CriticalityRequest,
)

REQUIRED_FIELDS = {"detailed_what_happened": "x", "detailed_why_it_happened": "x"}

FIELD_LIMITS = [
    ("detailed_what_happened", MAX_FREE_TEXT_LENGTH),
    ("detailed_why_it_happened", MAX_FREE_TEXT_LENGTH),
    ("incident_id", MAX_INCIDENT_ID_LENGTH),
    ("incident_types", MAX_INCIDENT_TYPES_LENGTH),
    ("substance_carried", MAX_SUBSTANCE_CARRIED_LENGTH),
    ("duration_of_interruption", MAX_DURATION_LENGTH),
    ("equipment_or_component_involved", MAX_EQUIPMENT_LENGTH),
    ("pipeline_outside_diameter_nps", MAX_PIPE_DIAMETER_LENGTH),
    ("nominal_pipe_size", MAX_PIPE_SIZE_LENGTH),
]


@pytest.mark.parametrize("field_name, max_length", FIELD_LIMITS)
def test_field_rejects_value_over_max_length(field_name, max_length):
    kwargs = {**REQUIRED_FIELDS, field_name: "x" * (max_length + 1)}

    with pytest.raises(ValidationError):
        CriticalityRequest(**kwargs)


@pytest.mark.parametrize("field_name, max_length", FIELD_LIMITS)
def test_field_accepts_value_at_max_length(field_name, max_length):
    kwargs = {**REQUIRED_FIELDS, field_name: "x" * max_length}

    request = CriticalityRequest(**kwargs)

    assert len(getattr(request, field_name)) == max_length


@pytest.mark.parametrize("value", ["Not Emergency", "Level I", "Level II", "Level III", "Emergency"])
def test_emergency_level_accepts_known_values(value):
    request = CriticalityRequest(**REQUIRED_FIELDS, emergency_level=value)

    assert request.emergency_level == value


def test_emergency_level_rejects_unknown_value():
    with pytest.raises(ValidationError):
        CriticalityRequest(**REQUIRED_FIELDS, emergency_level="Level 2 (typo)")


def test_emergency_level_defaults_to_none():
    request = CriticalityRequest(**REQUIRED_FIELDS)

    assert request.emergency_level is None

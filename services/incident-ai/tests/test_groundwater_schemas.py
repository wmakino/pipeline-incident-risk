import pytest
from pydantic import ValidationError

from app.features.groundwater.schemas import (
    MAX_INCIDENT_ID_LENGTH,
    MAX_INCIDENT_TYPE_LENGTH,
    MAX_LAND_USE_LENGTH,
    MAX_RESIDUAL_EFFECTS_LENGTH,
    MAX_SUBSTANCE_TYPE_LENGTH,
    GroundwaterImpactRequest,
    GroundwaterImpactResponse,
)

REQUIRED_FIELDS = {"latitude": 53.5461, "longitude": -113.4938, "release_type": "Liquid"}

FIELD_LIMITS = [
    ("incident_id", MAX_INCIDENT_ID_LENGTH),
    ("released_substance_type", MAX_SUBSTANCE_TYPE_LENGTH),
    ("incident_type", MAX_INCIDENT_TYPE_LENGTH),
    ("residual_effects_on_environment", MAX_RESIDUAL_EFFECTS_LENGTH),
    ("land_use", MAX_LAND_USE_LENGTH),
]


@pytest.mark.parametrize("field_name, max_length", FIELD_LIMITS)
def test_field_rejects_value_over_max_length(field_name, max_length):
    kwargs = {**REQUIRED_FIELDS, field_name: "x" * (max_length + 1)}

    with pytest.raises(ValidationError):
        GroundwaterImpactRequest(**kwargs)


@pytest.mark.parametrize("field_name, max_length", FIELD_LIMITS)
def test_field_accepts_value_at_max_length(field_name, max_length):
    kwargs = {**REQUIRED_FIELDS, field_name: "x" * max_length}

    request = GroundwaterImpactRequest(**kwargs)

    assert len(getattr(request, field_name)) == max_length


@pytest.mark.parametrize("value", ["Liquid", "Gas", "Miscellaneous", "Not Applicable"])
def test_release_type_accepts_known_values(value):
    request = GroundwaterImpactRequest(latitude=53.5461, longitude=-113.4938, release_type=value)

    assert request.release_type == value


def test_release_type_rejects_unknown_value():
    with pytest.raises(ValidationError):
        GroundwaterImpactRequest(latitude=53.5461, longitude=-113.4938, release_type="Solid")


def test_release_type_is_required():
    with pytest.raises(ValidationError):
        GroundwaterImpactRequest(latitude=53.5461, longitude=-113.4938)


def test_latitude_and_longitude_are_required():
    with pytest.raises(ValidationError):
        GroundwaterImpactRequest(release_type="Liquid")


def test_released_volume_m3_defaults_to_none():
    request = GroundwaterImpactRequest(**REQUIRED_FIELDS)

    assert request.released_volume_m3 is None


def test_released_volume_m3_accepts_a_float():
    request = GroundwaterImpactRequest(**REQUIRED_FIELDS, released_volume_m3=12.5)

    assert request.released_volume_m3 == 12.5


REQUIRED_RESPONSE_FIELDS = {
    "groundwater_impact_score": 3,
    "reasoning": "x",
    "confidence": 0.8,
    "status": "scored",
    "avi_index": 3,
    "avi_status": "available",
}


def test_response_accepts_a_no_coverage_result_with_null_index():
    response = GroundwaterImpactResponse(**{**REQUIRED_RESPONSE_FIELDS, "avi_index": None, "avi_status": "no_coverage"})

    assert response.avi_index is None
    assert response.avi_status == "no_coverage"


def test_response_rejects_unknown_avi_status():
    with pytest.raises(ValidationError):
        GroundwaterImpactResponse(**{**REQUIRED_RESPONSE_FIELDS, "avi_status": "unavailable"})


def test_response_rejects_unknown_status():
    with pytest.raises(ValidationError):
        GroundwaterImpactResponse(**{**REQUIRED_RESPONSE_FIELDS, "status": "pending"})


@pytest.mark.parametrize("score", [0, 6])
def test_response_rejects_score_outside_1_to_5(score):
    with pytest.raises(ValidationError):
        GroundwaterImpactResponse(**{**REQUIRED_RESPONSE_FIELDS, "groundwater_impact_score": score})


@pytest.mark.parametrize("confidence", [-0.1, 1.1])
def test_response_rejects_confidence_outside_0_to_1(confidence):
    with pytest.raises(ValidationError):
        GroundwaterImpactResponse(**{**REQUIRED_RESPONSE_FIELDS, "confidence": confidence})

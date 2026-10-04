from fastapi import APIRouter, Depends

from app.core.auth import require_api_key
from app.features.groundwater.schemas import GroundwaterImpactRequest, GroundwaterImpactResponse
from app.features.groundwater.service import score_groundwater_impact

router = APIRouter(prefix="/groundwater", tags=["groundwater"])


@router.post("/impact", response_model=GroundwaterImpactResponse, dependencies=[Depends(require_api_key)])
def impact(request: GroundwaterImpactRequest) -> GroundwaterImpactResponse:
    return score_groundwater_impact(request)

from fastapi import APIRouter, Depends

from app.core.auth import require_api_key
from app.features.criticality.schemas import CriticalityRequest, CriticalityResponse
from app.features.criticality.service import score_incident

router = APIRouter(prefix="/criticality", tags=["criticality"])


@router.post("/score", response_model=CriticalityResponse, dependencies=[Depends(require_api_key)])
def score(request: CriticalityRequest) -> CriticalityResponse:
    return score_incident(request)

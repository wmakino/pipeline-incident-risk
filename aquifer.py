"""Alberta aquifer vulnerability at an incident point.

The raster and the lookup live in the vendored incident-ai service. The index
is a fact about the ground. It is not a step in the risk score.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_LOOKUP = Path(__file__).resolve().parent / (
    "services/incident-ai/app/features/groundwater/aquifer_lookup.py"
)


_module = None


def get_aquifer_vulnerability(latitude: float, longitude: float) -> tuple[int | None, str]:
    global _module
    if _module is None:
        spec = importlib.util.spec_from_file_location("incident_ai_aquifer_lookup", _LOOKUP)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"aquifer lookup is missing: {_LOOKUP}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _module = module
    return _module.get_aquifer_vulnerability(latitude, longitude)

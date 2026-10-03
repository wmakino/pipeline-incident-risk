"""Consequence for one pipeline incident, on a 1-5 criteria table.

The base is a positive Approximate Volume Released, compared inside its release
type. Gas uses 1,000 and 100,000 cubic metres. Liquid and miscellaneous use
10 and 100. A missing volume is not scored as zero.

An elevated population-density label adds one step when a volume base exists.
With no positive volume, that same label is the base itself and is not added
again. A second step is one category token: Natural Force Damage, or Natural
or Environmental Forces. The other what and why labels are causes, so they
do not add. The level stops at 5.

No positive volume and no elevated label means no consequence. Risk is
likelihood times consequence only when both exist. The level is not a damage
cost and does not certify a line as safe.
"""

from __future__ import annotations

import math

CONSEQUENCE_NAMES = {
    1: "Slight",
    2: "Limited",
    3: "Moderate",
    4: "Major",
    5: "Severe",
}

GAS_MIDDLE_M3 = 1_000.0
GAS_HIGH_M3 = 100_000.0
LIQUID_MIDDLE_M3 = 10.0
LIQUID_HIGH_M3 = 100.0

WHAT_CATEGORY_TOKENS = frozenset({"Natural Force Damage"})
WHY_CATEGORY_TOKENS = frozenset({"Natural or Environmental Forces"})

ELEVATED_DENSITY = frozenset(
    {
        "46 or more dwelling units",
        (
            "46 or more dwelling units, facilities, or institutions, or a combination of "
            "such structures intended for human occupancy from which rapid evacuation can "
            "be difficult (e.g., hospitals, nursing homes)"
        ),
        "Buildings greater than 4 stories above ground",
        (
            "Within 200 m of event site - an industrial installation "
            "(e.g., a chemical plant or a hazardous substance storage area"
        ),
        "within 200 m of the event site - A building occupied by 20 to 120 persons during normal use",
        (
            "within 200 m of event site - a small, well-defined outside area occupied by "
            "20 to approximately 120 persons during normal use (e.g., a playground, "
            "recreation area, or other place of public assembly)"
        ),
    }
)


def parse_volume(text: str) -> float | None:
    """Positive cubic metres. Blank, zero, and non-numeric text are missing."""
    cleaned = text.strip().replace(",", "")
    if cleaned == "":
        return None
    try:
        value = float(cleaned)
    except ValueError:
        return None
    if not math.isfinite(value) or value <= 0:
        return None
    return value


def volume_base(release_type: str, volume_m3: float | None) -> int | None:
    """4, 3, or 1 from the release size. None when the volume is missing."""
    if volume_m3 is None:
        return None
    kind = release_type.strip()
    if kind == "Gas":
        middle, high = GAS_MIDDLE_M3, GAS_HIGH_M3
    elif kind in {"Liquid", "Miscellaneous"}:
        middle, high = LIQUID_MIDDLE_M3, LIQUID_HIGH_M3
    else:
        return None
    if volume_m3 >= high:
        return 4
    if volume_m3 >= middle:
        return 3
    return 1


def _tokens(label: str) -> set[str]:
    return {part.strip() for part in label.split(",") if part.strip()}


def category_step(what_happened: str, why_it_happened: str) -> bool:
    """One step if either column contains a locked token."""
    return bool(
        _tokens(what_happened) & WHAT_CATEGORY_TOKENS or _tokens(why_it_happened) & WHY_CATEGORY_TOKENS
    )


def elevated_density(population_density: str) -> bool:
    return population_density.strip() in ELEVATED_DENSITY


def consequence_level(
    release_type: str,
    approximate_volume: str,
    population_density: str,
    what_happened: str,
    why_it_happened: str,
) -> int | None:
    """Integer 1-5, or None when this row has neither a volume nor elevated density."""
    base = volume_base(release_type, parse_volume(approximate_volume))
    elevated = elevated_density(population_density)
    category = category_step(what_happened, why_it_happened)
    if base is None:
        if not elevated:
            return None
        return 2 if category else 1
    level = base
    if elevated:
        level += 1
    if category:
        level += 1
    return min(level, 5)


def risk_product(likelihood: int, consequence: int | None) -> int | None:
    if consequence is None:
        return None
    return likelihood * consequence

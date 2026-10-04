"""Consequence for one pipeline incident, on a 1-5 criteria table.

The base comes from one of two places, in this order:

1. BOSCEM cost level. When the release is a liquid or miscellaneous release
   with a positive Approximate Volume Released, a known substance class, the
   EPA BOSCEM cost (response + socioeconomic + environmental) sets the base:
       under 500 thousand        -> 1
       500 thousand to 2.5 M     -> 2
       2.5 M to 20 M             -> 3
       20 M to 50 M              -> 4
       50 M and above            -> 5
   Response cost is scaled by a land-use modifier (water and wetlands cost
   more to respond to than barren land).
2. Volume base. When BOSCEM cannot be computed (gas release, uncategorized
   substance, unknown substance), the release volume is compared inside its
   release type. Gas uses 1,000 and 100,000 cubic metres. Liquid and
   miscellaneous use 10 and 100. A missing volume is not scored as zero.

BOSCEM replaces the volume base rather than adding to it, because the cost is
itself volume times a rate and would count size twice.

An elevated population-density label adds one step when a base exists. With
no base, that same label is the base itself and is not added again. A second
step is one category token: Natural Force Damage, or Natural or Environmental
Forces. The other what and why labels are causes, so they do not add. The
level stops at 5.

No base and no elevated label means no consequence. Risk is likelihood times
consequence only when both exist. The level is not a damage cost estimate for
an individual site and does not certify a line as safe.
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

# Lower bound of levels 2, 3, 4, 5. A cost exactly on a bound goes up a level.
BOSCEM_LEVEL_BOUNDS = (500_000.0, 2_500_000.0, 20_000_000.0, 50_000_000.0)

# BOSCEM unit costs are for liquid spills. Gas volumes are gaseous cubic metres
# and would be badly overstated by a per-m3 liquid rate. Add "Gas" here to
# apply BOSCEM to gas releases as well.
BOSCEM_RELEASE_TYPES = frozenset({"Liquid", "Miscellaneous"})

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

# --- BOSCEM (EPA) inputs, moved from env_costs.py ---------------------------

MEDIUM_MODIFIERS = {
    "BARREN LAND": 0.90,
    "DEVELOPED LAND - INDUSTRIAL": 1.00,
    "DEVELOPED LAND - COMMERCIAL": 1.10,
    "DEVELOPED LAND - RESIDENTIAL": 1.20,
    "AGRICULTURAL CROPLAND": 1.20,
    "VEGETATIVE BARREN": 1.10,
    "SHRUB LAND": 1.30,
    "FORESTS": 1.40,
    "TUNDRA / NATIVE PRAIRIE / PARKS": 1.60,
    "WATER / WETLANDS": 1.75,
    "UNKNOWN LAND USE (HISTORICAL DATA MIGRATION)": 1.00,
}

SUBSTANCE = {
    "NATURAL GAS - SWEET": "LIGHT FUELS",
    "NOT APPLICABLE": "UNCATEGORIZED",
    "SULPHUR": "UNCATEGORIZED",
    "HYDROGEN SULPHIDE": "UNCATEGORIZED",
    "NATURAL GAS LIQUIDS": "LIGHT FUELS",
    "NATURAL GAS - SOUR": "LIGHT FUELS",
    "CRUDE OIL - SYNTHETIC": "CRUDE OIL",
    "BUTANE": "LIGHT FUELS",
    "PROPANE": "LIGHT FUELS",
    "CRUDE OIL - SWEET": "CRUDE OIL",
    "WATER": "UNCATEGORIZED",
    "PULP SLURRY": "UNCATEGORIZED",
    "LUBE OIL": "LIGHT FUELS",
    "HYDRAULIC FLUID": "LIGHT FUELS",
    "DRILLING FLUID": "LIGHT FUELS",
    "CARBON DIOXIDE": "UNCATEGORIZED",
    "FUEL GAS": "LIGHT FUELS",
    "GASOLINE": "LIGHT FUELS",
    "MIXED HVP HYDROCARBONS": "LIGHT FUELS",
    "CRUDE OIL - SOUR": "CRUDE OIL",
    "JET FUEL": "LIGHT FUELS",
    "CONTAMINATED WATER": "UNCATEGORIZED",
    "ODOURANT": "UNCATEGORIZED",
    "POTASSIUM HYDROXIDE (CAUSTIC SOLUTION)": "UNCATEGORIZED",
    "CONDENSATE": "LIGHT FUELS",
    "SULPHUR DIOXIDE": "UNCATEGORIZED",
    "AMINE": "UNCATEGORIZED",
    "POTASSIUM CARBONATE": "UNCATEGORIZED",
    "DIESEL FUEL": "LIGHT FUELS",
    "WASTE OIL": "HEAVY OILS",
    "PRODUCED WATER": "UNCATEGORIZED",
    "GLYCOL": "UNCATEGORIZED",
}

# BOSCEM unit costs per m3 by spill class.
# UNCATEGORIZED has no rates, so those substances get no BOSCEM cost.
BOSCEM_RATES = {
    "LIGHT FUELS": {"response_rate": 262.50, "socio_rate": 205.00, "env_rate": 55.00},
    "HEAVY OILS": {"response_rate": 270.00, "socio_rate": 387.50, "env_rate": 65.00},
    "CRUDE OIL": {"response_rate": 169.00, "socio_rate": 180.00, "env_rate": 60.00},
}


def boscem_cost(substance: str, land_use: str, volume_m3: float | None) -> float | None:
    """EPA BOSCEM cost for one release, or None when it cannot be computed.

    Response cost is scaled by the land-use modifier (unknown land use is 1.0).
    Socioeconomic and environmental costs are volume times rate, unmodified.
    """
    if volume_m3 is None:
        return None
    spill_class = SUBSTANCE.get(substance.strip().upper())
    rates = BOSCEM_RATES.get(spill_class) if spill_class else None
    if rates is None:
        return None
    modifier = MEDIUM_MODIFIERS.get(land_use.strip().upper(), 1.00)
    response = volume_m3 * rates["response_rate"] * modifier
    socio = volume_m3 * rates["socio_rate"]
    env = volume_m3 * rates["env_rate"]
    return response + socio + env


def boscem_level(cost: float | None) -> int | None:
    """1-5 from the BOSCEM cost bands. None when there is no cost."""
    if cost is None:
        return None
    return 1 + sum(cost >= bound for bound in BOSCEM_LEVEL_BOUNDS)


# --- Volume, density, category ----------------------------------------------


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


def incident_boscem_cost(
    release_type: str,
    approximate_volume: str,
    substance: str = "",
    land_use: str = "",
) -> float | None:
    """BOSCEM cost for an incident row, or None when it does not apply."""
    if release_type.strip() not in BOSCEM_RELEASE_TYPES:
        return None
    return boscem_cost(substance, land_use, parse_volume(approximate_volume))


def consequence_level(
    release_type: str,
    approximate_volume: str,
    population_density: str,
    what_happened: str,
    why_it_happened: str,
    substance: str = "",
    land_use: str = "",
) -> int | None:
    """Integer 1-5, or None when this row has neither a base nor elevated density."""
    base = boscem_level(
        incident_boscem_cost(release_type, approximate_volume, substance, land_use)
    )
    if base is None:
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
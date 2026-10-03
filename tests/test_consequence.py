"""Consequence is a 1-5 criteria table, parallel to likelihood."""

from pathlib import Path

import pytest

from consequence import (
    CONSEQUENCE_NAMES,
    ELEVATED_DENSITY,
    WHY_CATEGORY_TOKENS,
    WHAT_CATEGORY_TOKENS,
    category_step,
    consequence_level,
    parse_volume,
    risk_product,
    volume_base,
)

INDUSTRIAL = (
    "Within 200 m of event site - an industrial installation "
    "(e.g., a chemical plant or a hazardous substance storage area"
)
HARD_TO_EVACUATE = (
    "46 or more dwelling units, facilities, or institutions, or a combination of "
    "such structures intended for human occupancy from which rapid evacuation can "
    "be difficult (e.g., hospitals, nursing homes)"
)
OCCUPIED_BUILDING = (
    "within 200 m of the event site - A building occupied by 20 to 120 persons during normal use"
)
OUTSIDE_GATHERING = (
    "within 200 m of event site - a small, well-defined outside area occupied by "
    "20 to approximately 120 persons during normal use (e.g., a playground, "
    "recreation area, or other place of public assembly)"
)


def level(
    release_type: str = "Gas",
    volume: str = "",
    density: str = "10 or fewer dwelling units",
    what: str = "Equipment Failure",
    why: str = "Maintenance",
) -> int | None:
    return consequence_level(release_type, volume, density, what, why)


def test_names_are_severity_words_not_likelihood_words():
    assert CONSEQUENCE_NAMES == {
        1: "Slight",
        2: "Limited",
        3: "Moderate",
        4: "Major",
        5: "Severe",
    }


def test_positive_volume_parses_and_missing_does_not_become_zero():
    assert parse_volume("68") == 68
    assert parse_volume("1,000") == 1000
    assert parse_volume(" 7.5 ") == 7.5
    assert parse_volume("") is None
    assert parse_volume("0") is None
    assert parse_volume("Not Applicable") is None
    assert parse_volume("Not Provided") is None


def test_gas_bands_are_round_cubic_metres():
    assert volume_base("Gas", 100_000) == 4
    assert volume_base("Gas", 99_999.9) == 3
    assert volume_base("Gas", 1_000) == 3
    assert volume_base("Gas", 999.9) == 1
    assert volume_base("Gas", None) is None


def test_liquid_and_miscellaneous_share_a_smaller_scale():
    for kind in ("Liquid", "Miscellaneous"):
        assert volume_base(kind, 100) == 4
        assert volume_base(kind, 99.9) == 3
        assert volume_base(kind, 10) == 3
        assert volume_base(kind, 9.9) == 1
    assert volume_base("Gas", 50) == 1
    assert volume_base("Liquid", 50) == 3
    assert volume_base("Not Applicable", 50) is None


def test_plain_large_release_stays_above_a_small_release_with_both_steps():
    plain_large = level("Gas", "100000")
    small_both = level("Gas", "10", INDUSTRIAL, "Natural Force Damage", "Maintenance")
    assert plain_large == 4
    assert small_both == 3
    assert plain_large > small_both


def test_steps_add_one_and_cap_at_five():
    assert level("Gas", "100000") == 4
    assert level("Gas", "100000", "46 or more dwelling units") == 5
    assert level("Gas", "100000", what="Natural Force Damage") == 5
    assert level("Gas", "100000", "46 or more dwelling units", "Natural Force Damage") == 5
    assert level("Gas", "1000") == 3
    assert level("Gas", "1000", "Buildings greater than 4 stories above ground", "Natural Force Damage") == 5
    assert level("Gas", "10") == 1
    assert level("Gas", "10", "46 or more dwelling units") == 2
    assert level("Liquid", "100") == 4
    assert level("Miscellaneous", "1000") == 4


def test_elevated_density_without_volume_is_a_base_and_is_not_added_twice():
    assert level("Not Applicable", "", INDUSTRIAL) == 1
    assert level("Gas", "Not Provided", HARD_TO_EVACUATE) == 1
    assert level("Liquid", "0", OCCUPIED_BUILDING, "Natural Force Damage") == 2
    assert level("Miscellaneous", "", OUTSIDE_GATHERING) == 1


def test_low_or_unknown_density_without_volume_has_no_consequence():
    assert level("Not Applicable", "Not Applicable", "10 or fewer dwelling units") is None
    assert level("Gas", "", "11 to 45 dwelling units") is None
    assert level("Gas", "Not Provided", "Unknown Population Density (Historical Data Migration)") is None
    assert (
        level(
            "Gas",
            "",
            "10 or fewer dwelling units",
            "Natural Force Damage",
            "Natural or Environmental Forces",
        )
        is None
    )


def test_category_step_is_one_token_on_either_column():
    assert WHAT_CATEGORY_TOKENS == frozenset({"Natural Force Damage"})
    assert WHY_CATEGORY_TOKENS == frozenset({"Natural or Environmental Forces"})
    assert category_step("External Interference, Natural Force Damage", "Maintenance") is True
    assert category_step("Equipment Failure", "Natural or Environmental Forces, Maintenance") is True
    assert category_step("External Interference", "Human Factors") is False
    assert category_step("To be determined", "Other Causes") is False
    assert category_step("Corrosion and Cracking", "Inadequate Supervision") is False


def test_elevated_labels_match_the_stored_strings():
    assert "46 or more dwelling units" in ELEVATED_DENSITY
    assert INDUSTRIAL in ELEVATED_DENSITY
    assert HARD_TO_EVACUATE in ELEVATED_DENSITY
    assert "Buildings greater than 4 stories above ground" in ELEVATED_DENSITY
    assert OCCUPIED_BUILDING in ELEVATED_DENSITY
    assert OUTSIDE_GATHERING in ELEVATED_DENSITY
    assert "10 or fewer dwelling units" not in ELEVATED_DENSITY
    assert "11 to 45 dwelling units" not in ELEVATED_DENSITY
    assert "Unknown Population Density (Historical Data Migration)" not in ELEVATED_DENSITY


def test_risk_is_the_product_only_when_consequence_exists():
    assert risk_product(4, 4) == 16
    assert risk_product(1, 5) == 5
    assert risk_product(5, None) is None


ROOT = Path(__file__).parents[1]
CER_PATH = ROOT / "data" / "pipeline-incidents-comprehensive-data.csv"


@pytest.mark.skipif(not CER_PATH.exists(), reason="CER file is not downloaded")
def test_cer_file_scores_consequence_from_the_locked_bands():
    from map_likelihood import load_cer_incidents

    loaded = load_cer_incidents(CER_PATH)
    scored = [
        consequence_level(
            item.release_type,
            item.approximate_volume,
            item.population_density,
            item.what_happened_category,
            item.why_it_happened_category,
        )
        for item in loaded
    ]
    assert len(scored) == 2034
    assert sum(level is None for level in scored) == 2034 - 682
    assert all(level is None or 1 <= level <= 5 for level in scored)

    by_id = {item.incident.incident_id: item for item in loaded}
    fort_mcmurray = by_id["INC2013-146"]
    assert parse_volume(fort_mcmurray.approximate_volume) == 16_500_000
    assert consequence_level(
        fort_mcmurray.release_type,
        fort_mcmurray.approximate_volume,
        fort_mcmurray.population_density,
        fort_mcmurray.what_happened_category,
        fort_mcmurray.why_it_happened_category,
    ) >= 4

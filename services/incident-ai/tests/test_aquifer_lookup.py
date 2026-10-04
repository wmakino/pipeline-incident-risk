"""Tests for the AVI raster lookup. Expected values were verified against the
real raster file in scripts/spike_aquifer_lookup.py before this module existed."""

from app.features.groundwater.aquifer_lookup import _load_raster, get_aquifer_vulnerability


def test_in_province_coordinate_returns_its_real_vulnerability_index():
    index, status = get_aquifer_vulnerability(53.54423100, -113.34926900)
    assert index == 3
    assert status == "available"


def test_a_different_in_province_coordinate_returns_a_different_index():
    index, status = get_aquifer_vulnerability(50.17311810, -111.16565400)
    assert index == 1
    assert status == "available"


def test_coordinate_in_british_columbia_is_entirely_outside_the_raster_grid():
    index, status = get_aquifer_vulnerability(51.31303645, -120.17762182)
    assert index is None
    assert status == "no_coverage"


def test_coordinate_in_saskatchewan_is_entirely_outside_the_raster_grid():
    index, status = get_aquifer_vulnerability(51.64917000, -108.21167000)
    assert index is None
    assert status == "no_coverage"


def test_jasper_is_inside_alberta_and_inside_the_grid_but_was_never_mapped():
    # Jasper sits in the Rockies: inside Alberta and inside the raster's
    # extent, but the 2002 well-log survey never assessed this terrain, so
    # the pixel itself is the NoData sentinel (255) - a different cause than
    # the two tests above, which land outside the grid entirely.
    index, status = get_aquifer_vulnerability(52.8737, -117.9538)
    assert index is None
    assert status == "no_coverage"


def test_raster_is_loaded_once_and_reused_across_calls():
    _load_raster.cache_clear()
    get_aquifer_vulnerability(53.5461, -113.4938)
    get_aquifer_vulnerability(51.0447, -114.0719)
    assert _load_raster.cache_info().hits >= 1

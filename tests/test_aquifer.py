from aquifer import get_aquifer_vulnerability


def test_the_published_edmonton_point_reads_index_3():
    index, status = get_aquifer_vulnerability(53.544231, -113.349269)
    assert status == "available"
    assert index == 3


def test_a_point_outside_alberta_has_no_coverage():
    index, status = get_aquifer_vulnerability(45.4, -75.7)
    assert status == "no_coverage"
    assert index is None

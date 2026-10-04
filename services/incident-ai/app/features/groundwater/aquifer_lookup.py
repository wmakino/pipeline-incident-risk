"""Looks up Alberta's Aquifer Vulnerability Index (AVI) for a coordinate.

Mechanism verified against the real raster file in
scripts/spike_aquifer_lookup.py before this module existed: reproject the
incoming WGS84 (lat, lon) into the raster's own CRS, convert to a pixel via
the .tfw affine transform, and read that one pixel directly.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from PIL import Image
from PIL.Image import Image as PILImage
from pyproj import Transformer

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "aquifer"
TIF_PATH = DATA_DIR / "AquiferVulnerabilityIndex.tif"
TFW_PATH = DATA_DIR / "AquiferVulnerabilityIndex.tfw"

NODATA = 255
MIN_VALID_INDEX = 1
MAX_VALID_INDEX = 6

# NAD83 Transverse Mercator, central meridian -115, false easting 500000,
# scale factor 0.9992 - confirmed from AquiferVulnerabilityIndex.tif.xml.
RASTER_CRS = (
    "+proj=tmerc +lat_0=0 +lon_0=-115 +k=0.9992 "
    "+x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs"
)

AVIStatus = Literal["available", "no_coverage"]


@lru_cache
def _load_raster() -> PILImage:
    return Image.open(TIF_PATH)


@lru_cache
def _load_affine() -> tuple[float, float, float, float]:
    px_x, _, _, px_y, origin_x, origin_y = (
        float(line) for line in TFW_PATH.read_text().splitlines() if line.strip()
    )
    return px_x, px_y, origin_x, origin_y


@lru_cache
def _get_transformer() -> Transformer:
    return Transformer.from_crs("EPSG:4326", RASTER_CRS, always_xy=True)


def get_aquifer_vulnerability(lat: float, lon: float) -> tuple[int | None, AVIStatus]:
    """Returns (avi_index, avi_status). avi_index is 1-6 only when avi_status
    is "available" - every other outcome (outside the raster's grid, the
    raster's own NoData sentinel, or any unexpected value) is reported as
    (None, "no_coverage") rather than a guessed number."""
    image = _load_raster()
    px_x, px_y, origin_x, origin_y = _load_affine()
    transformer = _get_transformer()

    x, y = transformer.transform(lon, lat)
    col = int((x - origin_x) / px_x)
    row = int((origin_y - y) / abs(px_y))

    width, height = image.size
    if not (0 <= col < width and 0 <= row < height):
        return None, "no_coverage"

    value = image.getpixel((col, row))
    if not (MIN_VALID_INDEX <= value <= MAX_VALID_INDEX):
        return None, "no_coverage"

    return value, "available"

import pandas as pd


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
# BOSCEM unit costs per m3 by spill class
BOSCEM_RATES = pd.DataFrame(
    {
        "LIGHT FUELS": {"response_rate": 262.50, "socio_rate": 205.00, "env_rate": 55.00},
        "HEAVY OILS":  {"response_rate": 270.00, "socio_rate": 387.50, "env_rate": 65.00},
        "CRUDE OIL":   {"response_rate": 169.00, "socio_rate": 180.00, "env_rate": 60.00},
    }
).T

VOLUME = "Approximate Volume Released (m3)"


def get_rows_with_substances():
    data = pd.read_csv(
        "/home/fe/Downloads/pipeline-incidents-comprehensive-data.csv",
        encoding="latin-1",
        usecols=["Substance", "Land Use", VOLUME],
    )
    data[VOLUME] = pd.to_numeric(data[VOLUME], errors="coerce")
    data = data.dropna(subset=[VOLUME])
    data = data[data["Substance"].str.upper() != "NOT APPLICABLE"].copy()
    data["Spill"] = data["Substance"].str.upper().map(SUBSTANCE)
    return data


def spill_cost():
    # Uses EPA BOSCEM as the mathematical calculation for the cost of a spill.
    leaks = get_rows_with_substances().join(BOSCEM_RATES, on="Spill")

    vol = leaks[VOLUME]
    modifier = (
        leaks["Land Use"].str.strip().str.upper().map(MEDIUM_MODIFIERS).fillna(1.00)
    )

    leaks["Response Cost"] = vol * leaks["response_rate"] * modifier
    leaks["Socioeconomic Cost"] = vol * leaks["socio_rate"]
    leaks["Environmental Cost"] = vol * leaks["env_rate"]
    leaks["BOSCEM"] = (
        leaks["Response Cost"] + leaks["Socioeconomic Cost"] + leaks["Environmental Cost"]
    )

    return leaks.drop(columns=["response_rate", "socio_rate", "env_rate"])

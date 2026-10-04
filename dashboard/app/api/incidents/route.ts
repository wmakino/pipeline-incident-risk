import { plainValue, withMotherDuck } from "@/lib/motherduck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let loaded: Promise<{ type: "FeatureCollection"; features: unknown[] }> | null = null;

function incidents() {
  if (!loaded) {
    loaded = readIncidents().catch((error: unknown) => {
      loaded = null;
      throw error;
    });
  }
  return loaded;
}

async function readIncidents() {
  return withMotherDuck(async (connection) => {
    const reader = await connection.runAndReadAll("SELECT feature::VARCHAR FROM map_features");
    const features = reader.getRowsJS().map((row) => JSON.parse(String(plainValue(row[0]))));
    return { type: "FeatureCollection" as const, features };
  });
}

export async function GET() {
  try {
    return Response.json(await incidents());
  } catch (error) {
    console.error("incidents query failed", error instanceof Error ? error.name : "error");
    return Response.json({ detail: "Could not read incidents" }, { status: 500 });
  }
}

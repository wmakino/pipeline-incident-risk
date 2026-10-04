import { LIST_COLUMNS } from "@/lib/incidentRecord";
import { plainRow, withMotherDuck } from "@/lib/motherduck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_SQL = `SELECT ${LIST_COLUMNS.join(", ")} FROM incidents ORDER BY risk DESC NULLS LAST, incident_number`;

let loaded: Promise<Record<string, unknown>[]> | null = null;

function records() {
  if (!loaded) {
    loaded = readRecords().catch((error: unknown) => {
      loaded = null;
      throw error;
    });
  }
  return loaded;
}

async function readRecords() {
  return withMotherDuck(async (connection) => {
    const reader = await connection.runAndReadAll(LIST_SQL);
    return reader.getRowObjectsJS().map((row) => plainRow(row));
  });
}

export async function GET() {
  try {
    const rows = await records();
    if (rows.length === 0) {
      return Response.json({ detail: "Could not read incidents" }, { status: 500 });
    }
    return Response.json({ rows });
  } catch (error) {
    console.error("incident records query failed", error instanceof Error ? error.name : "error");
    return Response.json({ detail: "Could not read incidents" }, { status: 500 });
  }
}

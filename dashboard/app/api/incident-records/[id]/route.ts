import { plainRow, withMotherDuck } from "@/lib/motherduck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[A-Za-z0-9-]+$/;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) {
    return Response.json({ detail: "Unknown incident" }, { status: 404 });
  }
  try {
    const row = await withMotherDuck(async (connection) => {
      const reader = await connection.runAndReadAll(
        "SELECT * FROM incidents WHERE incident_number = ?",
        [id],
      );
      const rows = reader.getRowObjectsJS();
      return rows[0] ? plainRow(rows[0]) : null;
    });
    if (!row) return Response.json({ detail: "Unknown incident" }, { status: 404 });
    return Response.json({ row });
  } catch (error) {
    console.error("incident record query failed", error instanceof Error ? error.name : "error");
    return Response.json({ detail: "Could not read incidents" }, { status: 500 });
  }
}

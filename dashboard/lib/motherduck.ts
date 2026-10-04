import { readFileSync } from "fs";
import { resolve } from "path";
import { DuckDBInstance } from "@duckdb/node-api";

function motherduckToken(): string {
  const configured = process.env.MOTHERDUCK_TOKEN?.trim();
  if (configured) return configured;
  try {
    const text = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("MOTHERDUCK_TOKEN=")) continue;
      const token = line.slice("MOTHERDUCK_TOKEN=".length).trim();
      if (token) return token;
    }
  } catch {
    // The container has no repo-root .env. The token has to come from the environment.
  }
  throw new Error("MOTHERDUCK_TOKEN is not set");
}

export function plainValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function plainRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = plainValue(value);
  return out;
}

export async function withMotherDuck<T>(
  read: (connection: Awaited<ReturnType<DuckDBInstance["connect"]>>) => Promise<T>,
): Promise<T> {
  const instance = await DuckDBInstance.create("md:pipeline_incident_ai", {
    motherduck_token: motherduckToken(),
  });
  const connection = await instance.connect();
  try {
    return await read(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

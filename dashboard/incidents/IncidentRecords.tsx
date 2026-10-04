"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/corridor/components/Nav";
import { SearchInput } from "@/corridor/components/ui";
import { useTheme } from "@/corridor/hooks/useTheme";
import { assignedColumns, recordGroups, type IncidentRow, type RecordField } from "@/lib/incidentRecord";
import { sortIncidentRows, type IncidentSort, type SortKey } from "@/lib/incidentSort";
import "@/corridor/styles/tokens.css";
import "@/corridor/styles/global.css";
import "./records.css";

type ListRow = {
  incident_number: string;
  company: string;
  province: string;
  reported_date: string;
  likelihood: number | null;
  consequence: number | null;
  risk: number | null;
  criticality_score: number | null;
  groundwater_impact_score: number | null;
};

const NARRATIVE = new Set([
  "detailed_what_happened",
  "detailed_why_it_happened",
  "criticality_reasoning",
  "groundwater_reasoning",
]);

function scoreText(value: number | null): string {
  return value == null ? "—" : String(value);
}

function isWide(field: RecordField): boolean {
  return NARRATIVE.has(field.column) || field.value.length > 80;
}

const COLUMNS: { key: SortKey; label: string; title?: string; numeric?: boolean }[] = [
  { key: "incident_number", label: "Incident" },
  { key: "company", label: "Company" },
  { key: "province", label: "Province" },
  { key: "reported_date", label: "Reported" },
  { key: "likelihood", label: "L", title: "Likelihood", numeric: true },
  { key: "consequence", label: "C", title: "Consequence", numeric: true },
  { key: "risk", label: "R", title: "Risk", numeric: true },
  { key: "criticality_score", label: "Cr", title: "Criticality", numeric: true },
  { key: "groundwater_impact_score", label: "Gw", title: "Groundwater", numeric: true },
];

function firstDirection(key: SortKey): IncidentSort["direction"] {
  if (key === "incident_number" || key === "company" || key === "province") return "asc";
  return "desc";
}

export function IncidentRecords() {
  const { theme } = useTheme();
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<IncidentSort>({ key: "risk", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentRow | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/incident-records")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load incidents");
        return response.json() as Promise<{ rows: ListRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setRows(data.rows);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setListError(caught instanceof Error ? caught.message : "Could not load incidents");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    fetch(`/api/incident-records/${encodeURIComponent(selectedId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load that incident");
        return response.json() as Promise<{ row: IncidentRow }>;
      })
      .then((data) => {
        if (!cancelled) setDetail(data.row);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setDetailError(caught instanceof Error ? caught.message : "Could not load that incident");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = !rows
      ? []
      : !needle
        ? rows
        : rows.filter((row) =>
            [row.incident_number, row.company, row.province, row.reported_date]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          );
    return sortIncidentRows(matched, sort);
  }, [rows, query, sort]);

  function chooseSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: firstDirection(key) },
    );
  }

  const selected = visible.find((row) => row.incident_number === selectedId) ?? rows?.find((row) => row.incident_number === selectedId);
  const groups = detail ? recordGroups(detail) : [];
  const fieldCount = groups.reduce((sum, group) => sum + group.fields.length, 0);
  const emptyCount = detail ? assignedColumns().length - fieldCount : 0;
  const countLabel = rows
    ? `${visible.length.toLocaleString("en-CA")} of ${rows.length.toLocaleString("en-CA")}`
    : "Loading";

  return (
    <div className="corridor-root records-page" data-theme={theme}>
      <a href="#main" className="sr-only">Skip to content</a>
      <Nav />
      <main id="main" className="records-shell">
        <section className="records-index" aria-labelledby="incidents-title">
          <header className="records-head">
            <div className="records-head__row">
              <h1 id="incidents-title">Records</h1>
              <p>{countLabel}</p>
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Incident, company, or province" />
            {listError ? <p className="records-note">{listError}</p> : null}
          </header>
          <div className="records-scroll">
            <table className="records-table">
              <colgroup>
                <col className="col-id" />
                <col className="col-company" />
                <col className="col-place" />
                <col className="col-date" />
                <col className="col-score" />
                <col className="col-score" />
                <col className="col-score" />
                <col className="col-score" />
                <col className="col-score" />
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    const active = sort.key === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className={column.numeric ? "num" : undefined}
                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          className={active ? `is-sorted is-${sort.direction}` : undefined}
                          title={column.title ?? `Sort by ${column.label}`}
                          onClick={() => chooseSort(column.key)}
                        >
                          {column.label}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const active = row.incident_number === selectedId;
                  return (
                    <tr
                      key={row.incident_number}
                      className={active ? "is-selected" : undefined}
                      aria-selected={active}
                      tabIndex={0}
                      onClick={() => setSelectedId(row.incident_number)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.incident_number);
                        }
                      }}
                    >
                      <th scope="row">{row.incident_number}</th>
                      <td className="clip" title={row.company}>{row.company}</td>
                      <td className="clip" title={row.province}>{row.province}</td>
                      <td>{row.reported_date}</td>
                      <td className="num">{scoreText(row.likelihood)}</td>
                      <td className="num">{scoreText(row.consequence)}</td>
                      <td className="num">{scoreText(row.risk)}</td>
                      <td className="num">{scoreText(row.criticality_score)}</td>
                      <td className="num">{scoreText(row.groundwater_impact_score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows && visible.length === 0 ? (
              <p className="records-note">No incidents match "{query.trim()}".</p>
            ) : null}
          </div>
        </section>

        <section className="records-sheet" aria-live="polite" aria-label="Incident record">
          {selectedId ? (
            <>
              <header className="records-sheet__head">
                <div>
                  <h2>{selectedId}</h2>
                  <p className="records-sheet__company">{selected?.company ?? ""}</p>
                  <p className="records-sheet__meta">
                    {detailError
                      ? detailError
                      : detail
                        ? `${fieldCount.toLocaleString("en-CA")} filled, ${emptyCount.toLocaleString("en-CA")} empty`
                        : "Loading the record"}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)}>Close</button>
              </header>
              <div className="records-sheet__body">
                {groups.map((group) => (
                  <section key={group.id}>
                    <h3>{group.title}</h3>
                    <dl>
                      {group.fields.map((field) => (
                        <div key={field.column} className={isWide(field) ? "is-wide" : undefined}>
                          <dt>{field.label}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="records-empty">
              <h2>Open a record</h2>
              <p>The index is the rank columns. The sheet is every filled field for the incident you choose. A long company name stays clipped in the index and is written out here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

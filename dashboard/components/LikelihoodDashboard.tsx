"use client";

import { useEffect, useState } from "react";
import { LikelihoodMap } from "@/components/LikelihoodMap";
import {
  CONSEQUENCE_NAMES,
  LEVEL_NAMES,
  UNSCORED_COLOR,
  levelColor,
  signalColor,
  summarize,
  type IncidentCollection,
  type LikelihoodLevel,
  type LikelihoodSummary,
  type MapSignal,
} from "@/lib/incidents";

const BRACKETS: { level: LikelihoodLevel; reported: string; steps: string }[] = [
  { level: 5, reported: "Under 1 year", steps: "Either or both" },
  { level: 5, reported: "1 year to under 3", steps: "Both" },
  { level: 4, reported: "Under 1 year", steps: "Neither" },
  { level: 4, reported: "1 year to under 3", steps: "One" },
  { level: 3, reported: "1 year to under 3", steps: "Neither" },
  { level: 3, reported: "3 years or older", steps: "Both" },
  { level: 2, reported: "3 years or older", steps: "One" },
  { level: 1, reported: "3 years or older", steps: "Neither" },
];

const CONSEQUENCE_BRACKETS: { level: LikelihoodLevel; base: string; steps: string }[] = [
  { level: 5, base: "Large release", steps: "Either or both" },
  { level: 5, base: "Middle release", steps: "Both" },
  { level: 4, base: "Large release", steps: "Neither" },
  { level: 4, base: "Middle release", steps: "One" },
  { level: 3, base: "Middle release", steps: "Neither" },
  { level: 3, base: "Small release", steps: "Both" },
  { level: 2, base: "Small release", steps: "One" },
  { level: 2, base: "Occupancy only", steps: "Category" },
  { level: 1, base: "Small release", steps: "Neither" },
  { level: 1, base: "Occupancy only", steps: "None" },
];

function ConsequenceBrackets() {
  const groups = new Map<LikelihoodLevel, typeof CONSEQUENCE_BRACKETS>();
  for (const row of CONSEQUENCE_BRACKETS) {
    const group = groups.get(row.level) ?? [];
    group.push(row);
    groups.set(row.level, group);
  }

  return (
    <>
      <table className="brackets">
        <caption>Consequence brackets</caption>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Base</th>
            <th scope="col">Steps</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([level, rows]) =>
            rows.map((row, index) => (
              <tr key={`${row.level}-${row.base}`} className={index === 0 ? "group-start" : undefined}>
                {index === 0 ? (
                  <th scope="row" rowSpan={rows.length}>
                    {level} {CONSEQUENCE_NAMES[level]}
                  </th>
                ) : null}
                <td>{row.base}</td>
                <td>{row.steps}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="muted">
        A large release is 100,000 m³ or more of gas, or 100 m³ or more of liquid or miscellaneous.
        A middle release is 1,000 to under 100,000 m³ of gas, or 10 to under 100 m³ of liquid or
        miscellaneous. A small release is a positive volume under those cuts. Occupancy only means
        no positive volume and an elevated population-density label. That label is the base, so it
        is not added again.
      </p>
      <p className="muted">
        A step adds 1, and the level stops at 5. Elevated density adds a step only when a volume
        base exists. The category step is Natural Force Damage, or Natural or Environmental Forces.
        Other what and why labels are causes and do not add. Missing volume is not scored as zero.
        Circle color is the risk, unless Likelihood or Consequence is selected above.
      </p>
    </>
  );
}

function LikelihoodBrackets() {
  const groups = new Map<LikelihoodLevel, typeof BRACKETS>();
  for (const row of BRACKETS) {
    const group = groups.get(row.level) ?? [];
    group.push(row);
    groups.set(row.level, group);
  }

  return (
    <>
      <table className="brackets">
        <caption>Likelihood brackets</caption>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Reported age</th>
            <th scope="col">Steps</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([level, rows]) =>
            rows.map((row, index) => (
              <tr key={`${row.level}-${row.reported}`} className={index === 0 ? "group-start" : undefined}>
                {index === 0 ? (
                  <th scope="row" rowSpan={rows.length}>
                    <span className="swatch" style={{ background: levelColor(level) }} />
                    <span>
                      {level} {LEVEL_NAMES[level]}
                    </span>
                  </th>
                ) : null}
                <td>{row.reported}</td>
                <td>{row.steps}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="muted">
        Reported age is years before 2026-09-25. A step adds 1, and the level stops at 5. Neighbor:
        n is at least 1, the same point more than once or another site under 100 m. Never inspected:
        that flag is Yes. Either, one, or both refers to those two steps.
      </p>
    </>
  );
}

const SIGNAL_OPTIONS: { id: MapSignal; label: string }[] = [
  { id: "likelihood", label: "Likelihood" },
  { id: "consequence", label: "Consequence" },
  { id: "risk", label: "Risk" },
];

function SignalLegend({ collection, signal }: { collection: IncidentCollection; signal: MapSignal }) {
  if (signal === "risk") {
    const missing = collection.features.filter((feature) => feature.properties.risk == null).length;
    return (
      <>
        <ul className="legend">
          <li>
            <span className="swatch" style={{ background: signalColor(1, "risk") }} />
            <span className="legend-label">1, lowest product</span>
          </li>
          <li>
            <span className="swatch" style={{ background: signalColor(25, "risk") }} />
            <span className="legend-label">25, highest product</span>
          </li>
          <li>
            <span className="swatch" style={{ background: UNSCORED_COLOR }} />
            <span className="legend-label">Not scored</span>
            <span className="legend-count">{missing.toLocaleString("en-CA")}</span>
          </li>
        </ul>
        <p className="muted">
          Nearby incidents draw as one bubble. The color is the highest risk in that bubble.
        </p>
      </>
    );
  }

  const levels = ([5, 4, 3, 2, 1] as LikelihoodLevel[]).map((level) => ({
    level,
    name: signal === "likelihood" ? LEVEL_NAMES[level] : CONSEQUENCE_NAMES[level],
    color: levelColor(level),
    count: collection.features.filter((feature) =>
      signal === "likelihood"
        ? feature.properties.likelihood === level
        : feature.properties.consequence === level,
    ).length,
  }));
  const missing =
    signal === "consequence"
      ? collection.features.filter((feature) => feature.properties.consequence == null).length
      : 0;

  return (
    <>
      <ul className="legend">
        {levels.map((level) => (
          <li key={level.level}>
            <span className="swatch" style={{ background: level.color }} />
            <span className="legend-label">
              {level.level} {level.name}
            </span>
            <span className="legend-count">{level.count.toLocaleString("en-CA")}</span>
          </li>
        ))}
        {signal === "consequence" ? (
          <li>
            <span className="swatch" style={{ background: UNSCORED_COLOR }} />
            <span className="legend-label">Not scored</span>
            <span className="legend-count">{missing.toLocaleString("en-CA")}</span>
          </li>
        ) : null}
      </ul>
      <p className="muted">
        Nearby incidents draw as one bubble. The color is the highest {signal} in that bubble.
      </p>
    </>
  );
}

export function LikelihoodDashboard() {
  const [collection, setCollection] = useState<IncidentCollection | null>(null);
  const [mapSignal, setMapSignal] = useState<MapSignal>("risk");
  const [summary, setSummary] = useState<LikelihoodSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [showPipelines, setShowPipelines] = useState(true);
  const [pipelineCount, setPipelineCount] = useState<number | null>(null);
  const [pipelineError, setPipelineError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/incidents.json")
      .then((response) => {
        if (!response.ok) throw new Error(`incidents.json ${response.status}`);
        return response.json() as Promise<IncidentCollection>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.features.length === 0) throw new Error("incidents.json has no features");
        setCollection(data);
        setSummary(summarize(data));
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load incidents");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={showPanel ? "shell" : "shell panel-hidden"}>
      <aside className="panel" aria-hidden={showPanel ? undefined : true}>
        <div className="panel-body">
        <div className="panel-head">
          <h1>Incident risk</h1>
          <button type="button" className="panel-hide" onClick={() => setShowPanel(false)}>
            Hide
          </button>
        </div>
        <p>
          Each circle is one incident from the CER pipeline incident file. Risk is likelihood
          times consequence, and only when both exist. The map color follows the selected part.
          Blue is lower and red is higher. A gray circle has no consequence, so it has no risk. This is not a
          safety certificate and not a repair design.
        </p>
        <fieldset className="signal-toggle">
          <legend>Map color</legend>
          {SIGNAL_OPTIONS.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="map-signal"
                value={option.id}
                checked={mapSignal === option.id}
                onChange={() => setMapSignal(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {collection ? <SignalLegend collection={collection} signal={mapSignal} /> : null}
        <LikelihoodBrackets />
        <ConsequenceBrackets />
        {summary ? (
          <>
            <label className="lines-toggle">
              <input
                type="checkbox"
                checked={showPipelines && !pipelineError}
                disabled={pipelineError || pipelineCount == null}
                onChange={(event) => setShowPipelines(event.target.checked)}
              />
              <span className="line-sample" aria-hidden="true" />
              <span>CER pipeline systems</span>
            </label>
            <p className="muted">
              {pipelineError
                ? "CER pipeline systems did not load. Incident circles are still shown. The lines are not part of the score."
                : pipelineCount == null
                  ? "Loading CER pipeline systems for this view. They are not part of the score."
                  : `${pipelineCount.toLocaleString("en-CA")} CER pipeline systems, fetched for this view and not kept in this project. They are not part of the score.`}
            </p>
            <p className="muted">
              {summary.plotted.toLocaleString("en-CA")} incidents plotted. Reported {summary.first}{" "}
              through {summary.last}. Source: CER pipeline incidents comprehensive data.
            </p>
          </>
        ) : (
          <p className="muted">{error ?? "Loading incidents…"}</p>
        )}
        </div>
      </aside>
      <div className="map-wrap">
        <button
          type="button"
          className={showPanel ? "panel-show is-hidden" : "panel-show"}
          onClick={() => setShowPanel(true)}
          tabIndex={showPanel ? -1 : 0}
          aria-hidden={showPanel}
        >
          Show panel
        </button>
        {collection ? (
          <LikelihoodMap
            collection={collection}
            mapSignal={mapSignal}
            showPipelines={showPipelines}
            onPipelines={(status) => {
              if (status.ok) {
                setPipelineCount(status.count);
                setPipelineError(false);
              } else {
                setPipelineError(true);
              }
            }}
          />
        ) : (
          <div className="map" />
        )}
      </div>
    </main>
  );
}

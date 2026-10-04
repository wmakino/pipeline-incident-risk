import {
  CONSEQUENCE_NAMES,
  LEVEL_NAMES,
  UNSCORED_COLOR,
  levelColor,
  signalColor,
  type IncidentCollection,
  type LikelihoodLevel,
  type MapSignal,
} from "@/lib/incidents";

const LIKELIHOOD_ROWS: { level: LikelihoodLevel; reported: string; steps: string }[] = [
  { level: 5, reported: "Under 1 year", steps: "Either or both" },
  { level: 5, reported: "1 year to under 3", steps: "Both" },
  { level: 4, reported: "Under 1 year", steps: "Neither" },
  { level: 4, reported: "1 year to under 3", steps: "One" },
  { level: 3, reported: "1 year to under 3", steps: "Neither" },
  { level: 3, reported: "3 years or older", steps: "Both" },
  { level: 2, reported: "3 years or older", steps: "One" },
  { level: 1, reported: "3 years or older", steps: "Neither" },
];

const CONSEQUENCE_ROWS: { level: LikelihoodLevel; base: string; steps: string }[] = [
  { level: 5, base: "Large release", steps: "Either or both" },
  { level: 5, base: "Middle release", steps: "Both" },
  { level: 4, base: "Large release", steps: "Neither" },
  { level: 4, base: "Middle release", steps: "One" },
  { level: 3, base: "Middle release", steps: "Neither" },
  { level: 3, base: "Small release", steps: "Both" },
  { level: 2, base: "Small release", steps: "One" },
  { level: 4, base: "Long interruption", steps: "None" },
  { level: 2, base: "Occupancy only", steps: "Category" },
  { level: 2, base: "Short interruption", steps: "None" },
  { level: 1, base: "Small release", steps: "Neither" },
  { level: 1, base: "Occupancy only", steps: "None" },
];

function grouped<T extends { level: LikelihoodLevel }>(rows: T[]): [LikelihoodLevel, T[]][] {
  const groups = new Map<LikelihoodLevel, T[]>();
  for (const row of rows) {
    const group = groups.get(row.level) ?? [];
    group.push(row);
    groups.set(row.level, group);
  }
  return [...groups.entries()];
}

export function ConsequenceBrackets() {
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
          {grouped(CONSEQUENCE_ROWS).map(([level, rows]) =>
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
        Other what and why labels are causes and do not add. A short interruption adds 1 and a long
        interruption adds 2. With no positive volume, a short interruption is the base at 2 and a
        long interruption is the base at 4. No interruption and a blank add nothing. Missing volume
        is not scored as zero. Circle color is the risk, unless Likelihood or Consequence is
        selected above.
      </p>
    </>
  );
}

export function LikelihoodBrackets() {
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
          {grouped(LIKELIHOOD_ROWS).map(([level, rows]) =>
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

export function SignalLegend({ collection, signal }: { collection: IncidentCollection; signal: MapSignal }) {
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

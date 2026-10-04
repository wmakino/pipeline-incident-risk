import type { FactorLine } from "../../api/types";

function FactorGroup({ title, lines }: { title: string; lines: FactorLine[] }) {
  return (
    <section>
      <h4 className="factors__h">{title}</h4>
      <dl className="factors__list">
        {lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function RiskFactors({
  likelihood,
  consequence,
  product,
}: {
  likelihood: FactorLine[];
  consequence: FactorLine[];
  product: string;
}) {
  return (
    <div className="factors">
      <FactorGroup title="Likelihood" lines={likelihood} />
      <FactorGroup title="Consequence" lines={consequence} />
      <p className="factors__product">
        <strong>Risk</strong> {product}
      </p>
    </div>
  );
}

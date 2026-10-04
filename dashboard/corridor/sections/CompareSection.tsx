import type { Ranking, RankingRow } from '../api/types';
import { productLabel } from '../api/labels';
import { Badge, ConsequenceBadge, SectionHeader } from '../components/ui';

function List({ title, sub, rows, mode, featured }: {
  title: string; sub: string; rows: RankingRow[]; mode: 'count' | 'score'; featured?: boolean;
}) {
  return (
    <div className={`compare__list${featured ? ' compare__list--featured' : ''}`}>
      <div className="compare__list-head">
        <div className="compare__title">
          <strong>{title}</strong>
          {featured && <Badge color="var(--brand-primary)" size="sm">CorridorWatch</Badge>}
        </div>
        <span className="small text-secondary">{sub}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="compare__item">
          <span className="compare__name">
            <strong className={featured ? 'compare__index compare__index--featured' : 'compare__index'}>{i + 1}</strong>
            {r.corridor}
          </span>
          <span className="compare__meta small text-secondary">
            {mode === 'count' ? `${r.incidents} incidents` : `Score ${r.score}`}
            <ConsequenceBadge value={r.consequence} size="sm" />
          </span>
        </div>
      ))}
    </div>
  );
}

function moverCopy(r: RankingRow) {
  const product = productLabel[r.product].toLowerCase();
  if (r.rank < r.count_rank)
    return `Fewer incidents, higher total risk. The ${product} history here scores higher on likelihood times consequence.`;
  return `More incidents, lower total risk. The ${product} count is high, and the summed risk is not.`;
}

export function CompareSection({ ranking }: { ranking: Ranking | null }) {
  if (!ranking) return <section id="compare" className="section section--band" />;
  const byCount = [...ranking.rows].sort((a, b) => a.count_rank - b.count_rank).slice(0, 5);
  const byScore = ranking.rows.slice(0, 5);
  const delta = (r: RankingRow) => r.count_rank - r.rank;
  const sorted = [...ranking.rows].sort((a, b) => delta(b) - delta(a));
  const movers = [sorted[0], sorted[sorted.length - 1], sorted[sorted.length - 2]].filter(Boolean);

  return (
    <section id="compare" className="section section--band" aria-labelledby="compare-title">
      <div className="container">
        <SectionHeader id="compare-title" title="Counting alone sends crews to the wrong places"
          sub="The busiest towns are not always the highest risk. The list on the right sums each incident’s likelihood times consequence." />
        <div className="compare__grid">
          <List title="Count-only ranking" sub="Most incidents first" rows={byCount} mode="count" />
          <span className="compare__arrow" aria-hidden="true">→</span>
          <List title="Risk ranking" sub="Sum of likelihood × consequence" rows={byScore} mode="score" featured />
        </div>
        <div className="compare__movers">
          {movers.map((r) => {
            const d = delta(r);
            const up = d > 0;
            return (
              <article key={r.id} className={`compare__mover card${up ? ' compare__mover--up' : ' compare__mover--down'}`}>
                <div className="compare__mover-head">
                  <span className="compare__title">
                    <strong>{r.corridor}</strong>
                    <Badge color={up ? 'var(--status-high)' : 'var(--status-low)'} size="sm">{up ? 'Rose' : 'Fell'}</Badge>
                  </span>
                  <strong className="compare__delta">{up ? '▲' : '▼'} {Math.abs(d)}</strong>
                </div>
                <span className="compare__shift small text-secondary">#{r.count_rank} → #{r.rank}</span>
                <p className="small text-secondary">{moverCopy(r)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

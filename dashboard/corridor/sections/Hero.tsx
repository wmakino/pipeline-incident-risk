import type { Ranking } from '../api/types';
import { productLabel } from '../api/labels';
import { Button, RankChip } from '../components/ui';

function incidentCount(count: number): string {
  return count === 1 ? '1 incident' : `${count} incidents`;
}

export function Hero({ ranking, onMap }: { ranking: Ranking | null; onMap: () => void }) {
  const top = ranking?.rows.slice(0, 3) ?? [];
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="hero container">
      <div className="hero__copy">
        <h1 className="hero__title">Inspect where it matters most</h1>
        <p className="hero__sub">
          {`CorridorWatch ranks Alberta pipeline towns by likelihood times consequence.${
            ranking ? ` ${ranking.total_incidents.toLocaleString()} Alberta incidents from 2008 to 2026.` : ''
          }`}
        </p>
        <div className="hero__ctas">
          <Button variant="primary" onClick={() => scroll('priority')}>View priority list</Button>
          <Button onClick={onMap}>Open map</Button>
          <Button onClick={() => scroll('method')}>How scoring works</Button>
        </div>
      </div>

      <aside className="hero__card card" aria-label="Highest town risk">
        <div className="hero__card-head">
          <span className="hero__card-label">Highest town risk</span>
          <span className="caption text-secondary hero__live"><span aria-hidden="true" />Updated Sep 25</span>
        </div>
        {top.map((r) => (
          <div key={r.id} className="hero__card-row">
            <RankChip rank={r.rank} />
            <div className="hero__card-name">
              <strong>{r.corridor}</strong>
              <span className="caption text-secondary">{productLabel[r.product]}, {incidentCount(r.incidents)}</span>
            </div>
            <div className="hero__card-score">
              <strong>{r.score}</strong>
              <span className="caption text-muted">risk score</span>
            </div>
          </div>
        ))}
      </aside>
    </section>
  );
}

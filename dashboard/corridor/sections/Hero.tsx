import type { Ranking } from '../api/types';
import { productLabel, consequenceLabel } from '../api/labels';
import { Button, RankChip } from '../components/ui';

export function Hero({ ranking, onMap }: { ranking: Ranking | null; onMap: () => void }) {
  const top = ranking?.rows.slice(0, 3) ?? [];
  const replaced = ranking ? 5 - ranking.top5_overlap_with_count_only : null;
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="hero container">
      <div className="hero__copy">
        <h1 className="hero__title">Inspect where it matters most</h1>
        <p className="hero__sub">
          {`CorridorWatch ranks Alberta pipeline towns by likelihood times consequence.${
            ranking ? ` ${ranking.total_incidents.toLocaleString()} incidents sit in named towns.` : ''
          } Crews walk the riskiest stretches first, not just the noisiest ones.`}
        </p>
        <div className="hero__ctas">
          <Button variant="primary" onClick={() => scroll('priority')}>View priority list →</Button>
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
              <span className="caption text-secondary">{productLabel[r.product]} · {consequenceLabel[r.consequence]} consequence</span>
            </div>
            <div className="hero__card-score">
              <strong>{r.score}</strong>
              <span className="caption text-muted">risk score</span>
            </div>
          </div>
        ))}
        {replaced !== null && (
          <div className="hero__card-foot caption">
            <strong className="hero__replaced">{replaced} of 5</strong>
            <span className="text-secondary">of the count-only top 5 drop out once each incident is scored by likelihood times consequence</span>
          </div>
        )}
      </aside>
    </section>
  );
}

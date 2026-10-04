import type { Ranking } from '../api/types';

export function StatsBar({ ranking }: { ranking: Ranking | null }) {
  const top = ranking?.rows[0];
  const stats = [
    { v: ranking ? ranking.total_incidents.toLocaleString() : '-', l: 'Alberta incidents', s: '2008 to 2026' },
    { v: ranking ? ranking.total_corridors.toLocaleString() : '-', l: 'Towns', s: 'Top 15 listed below' },
    { v: top ? String(top.score) : '-', l: 'Highest town risk', s: top ? top.corridor : '' },
    { v: ranking ? ranking.unscored.toLocaleString() : '-', l: 'Unscored incidents', s: ranking ? 'Excluded from risk total' : '' },
  ];
  return (
    <div className="container stats">
      <dl className="stats__bar card">
        {stats.map((s) => (
          <div key={s.l} className="stats__item">
            <dd className="stats__value">{s.v}</dd>
            <dt className="small stats__label">{s.l}</dt>
            <dd className="caption text-secondary">{s.s}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

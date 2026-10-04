import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onTransitionClick } from '@/lib/page-transition';
import type { CorridorDetail, Level, RankingRow } from '../../api/types';
import { consequenceColor, consequenceLabel, levelColor, levelLabel, productColor, productLabel } from '../../api/labels';
import { Badge, Button, Dot, StatTile, shiftLabel } from '../../components/ui';
import { RiskFactors } from "./RiskFactors";
import './drawer.css';

interface Props {
  detail: CorridorDetail | null;
  order: RankingRow[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const LEVELS: Level[] = [5, 4, 3, 2, 1];

function InfoPanel({ c }: { c: CorridorDetail }) {
  const max = Math.max(1, ...Object.values(c.by_level));
  const shift = shiftLabel(c.rank, c.count_rank);
  return (
    <div className="drawer__panel">
      <section className="drawer__block">
        <h3 className="drawer__h">Why it ranks #{c.rank}</h3>
        <p className="small text-secondary">{c.summary}</p>
      </section>

      <section className="drawer__stats" aria-label="Key numbers">
        <StatTile value={String(c.score)} label="Risk score" color="var(--brand-primary)" />
        <StatTile value={String(c.incidents)} label="Incidents" />
        <StatTile value={String(c.peak)} label="Highest incident" color={consequenceColor[c.consequence]} />
        <StatTile value={shift.text.split('  ')[0]} label={c.rank === c.count_rank ? 'Same as count-only' : `Shift from #${c.count_rank}`} color={shift.color} />
      </section>

      <section className="drawer__block">
        <div className="drawer__row-between">
          <h3 className="drawer__h">Incidents by likelihood</h3>
          <span className="caption text-muted">{c.incidents} total</span>
        </div>
        <ul className="drawer__levels">
          {LEVELS.map((l) => {
            const n = c.by_level[String(l) as keyof typeof c.by_level];
            return (
              <li key={l}>
                <Dot color={levelColor(l)} size={10} />
                <span className="drawer__level-name">{l} {levelLabel[l]}</span>
                <span className="bar" aria-hidden="true"><span style={{ width: `${(n / max) * 100}%`, background: levelColor(l) }} /></span>
                <span className="drawer__level-n">{n}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="drawer__block">
        <div className="drawer__row-between">
          <h3 className="drawer__h">Each incident</h3>
          <span className="caption text-muted">{c.items.length} total</span>
        </div>
        <ul className="drawer__incidents">
          {c.items.map((item) => (
            <li key={item.id}>
              <div className="drawer__incident-head">
                <strong>{item.type}</strong>
                <span className="caption text-muted">{item.id} · {item.date}</span>
              </div>
              <RiskFactors likelihood={item.likelihood} consequence={item.consequence} product={item.product} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function CorridorDrawer({ detail, order, onClose, onNavigate }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const id = detail?.id ?? "";

  const idx = order.findIndex((r) => r.id === id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      height: body.style.height,
    };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.height = 'auto';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.height = prev.height;
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && e.altKey && prev) onNavigate(prev.id);
      if (e.key === 'ArrowRight' && e.altKey && next) onNavigate(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, prev, next]);

  const c = detail;

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__header">
          <div className="drawer__title">
            <p className="drawer__rank">
              <span className="drawer__rank-n">{c?.rank ?? idx + 1}</span>
              <span className="caption text-muted">Rank</span>
            </p>
            <div>
              <span className="caption text-muted">Priority list  /  {c?.corridor ?? '…'}</span>
              <div className="drawer__title-row">
                <h2 id="drawer-title" className="h3 drawer__name">{c ? `${c.corridor} corridor` : 'Loading…'}</h2>
                {c && <Badge color={productColor[c.product]} size="sm">{productLabel[c.product]}</Badge>}
                {c && <Badge color={consequenceColor[c.consequence]} size="sm">{consequenceLabel[c.consequence]} consequence</Badge>}
              </div>
            </div>
          </div>
          <div className="drawer__header-actions">
            <div className="drawer__pager">
              <Button size="sm" disabled={!prev} onClick={() => prev && onNavigate(prev.id)} aria-label="Previous corridor">‹ Prev</Button>
              <Button size="sm" disabled={!next} onClick={() => next && onNavigate(next.id)} aria-label="Next corridor">Next ›</Button>
            </div>
            <Link href="/map" className="btn btn--primary btn--sm" onClick={onTransitionClick(router, "/map")}>Open the map</Link>
            <Button ref={closeRef} size="sm" icon onClick={onClose} aria-label="Close">✕</Button>
          </div>
        </header>

        <div className="drawer__body">
          {c ? (
            <InfoPanel c={c} />
          ) : (
            <div className="drawer__loading" aria-busy="true">
              <span className="skeleton" style={{ height: 120 }} />
              <span className="skeleton" style={{ height: 220 }} />
              <span className="skeleton" style={{ height: 180 }} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

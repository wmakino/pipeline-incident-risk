import { useMemo, useState, type KeyboardEvent } from 'react';
import { CONSEQUENCE_NAMES, type IncidentCollection } from '@/lib/incidents';
import { rankIncidents } from '@/lib/corridors';
import { IncidentDrawer } from '../features/drawer/IncidentDrawer';
import type { IncidentRankRow, Level, Product, Ranking } from '../api/types';
import { consequenceColor, levelColor, levelLabel } from '../api/labels';
import {
  ConsequenceBadge, Dot, ProductLabel, RankChip, SearchInput, SectionHeader, Segmented, shiftLabel,
} from '../components/ui';

type Filter = 'all' | Product;
type Mode = 'corridors' | 'incidents';

interface Props {
  ranking: Ranking | null;
  collection: IncidentCollection | null;
  loading: boolean;
  onOpen: (id: string) => void;
}

function matchesProduct(product: Product | null, filter: Filter): boolean {
  return filter === 'all' || product === filter;
}

function reportedLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', { dateStyle: 'medium', timeZone: 'UTC' });
}

function Score({ score, max, color, cell = true }: { score: number; max: number; color: string; cell?: boolean }) {
  return (
    <span className={`${cell ? 'table__cell ' : ''}table__score`} role={cell ? 'cell' : undefined}>
      <strong>{score}</strong>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${(score / max) * 100}%`, background: color }} />
      </span>
    </span>
  );
}

function formula(row: IncidentRankRow): string {
  const factors = [
    row.likelihood_note ? `Likelihood ${row.likelihood_note}` : "",
    row.consequence_note ? `Consequence ${row.consequence_note}` : "",
    row.product_note ? `${row.product_note} = ${row.score}` : "",
  ].filter(Boolean);
  return factors.join(". ");
}

function Calc({ note }: { note: string }) {
  if (!note) return null;
  return <span className="caption text-muted">{note}</span>;
}

function IncidentRow({ row, maxScore, onOpen, onKey }: {
  row: IncidentRankRow;
  maxScore: number;
  onOpen: (id: string) => void;
  onKey: (e: KeyboardEvent, id: string) => void;
}) {
  const calculation = [
    `Likelihood ${row.likelihood}${row.likelihood_note ? `, ${row.likelihood_note}` : ''}`,
    `Consequence ${row.consequence}${row.consequence_note ? `, ${row.consequence_note}` : ''}`,
    `Risk ${row.score}, ${row.product_note}`,
  ].join('. ');
  const line = formula(row);
  return (
    <div className="table__incident" onClick={() => onOpen(row.incident_id)}>
      <div className="table__row table__row--incident" role="row" tabIndex={0}
        aria-label={`Rank ${row.rank}, ${row.release_type}, ${row.corridor ?? 'town not named'}. ${calculation}. Open risk factors`}
        onKeyDown={(e) => onKey(e, row.incident_id)}>
        <span className="table__cell" role="cell"><RankChip rank={row.rank} /></span>
        <span className="table__cell table__name" role="cell">
          <strong>{row.release_type}</strong>
          <span className="caption text-muted">{row.incident_id} · {reportedLabel(row.reported)}</span>
        </span>
        <span className="table__cell" role="cell">{row.corridor ?? <span className="text-muted">Town not named</span>}</span>
        <span className="table__cell" role="cell">{row.product ? <ProductLabel value={row.product} /> : '—'}</span>
        <span className="table__cell" role="cell"><LevelMark level={row.likelihood} names={levelLabel} /></span>
        <span className="table__cell" role="cell"><LevelMark level={row.consequence} names={CONSEQUENCE_NAMES} /></span>
        <span className="table__cell table__calc" role="cell">
          <Score score={row.score} max={maxScore} color={levelColor(row.consequence)} cell={false} />
          <Calc note={row.product_note} />
        </span>
        <span className="table__cell table__chev" role="cell" aria-hidden="true">›</span>
      </div>
      {line ? <p className="table__formula caption text-muted">{line}</p> : null}
    </div>
  );
}

function LevelMark({ level, names }: { level: Level; names: Record<Level, string> }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Dot color={levelColor(level)} />
      {level} {names[level]}
    </span>
  );
}

export function PriorityList({ ranking, collection, loading, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<Mode>('corridors');
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const incidents = useMemo(() => (collection ? rankIncidents(collection) : null), [collection]);
  const needle = query.trim().toLowerCase();
  const opened = collection?.features.find((feature) => feature.properties.incident_id === incidentId)?.properties ?? null;

  const rows = useMemo(() => (ranking?.rows ?? []).filter((r) =>
    matchesProduct(r.product, filter) && r.corridor.toLowerCase().includes(needle)),
  [ranking, filter, needle]);
  const incidentRows = useMemo(() => (incidents?.rows ?? []).filter((r) =>
    matchesProduct(r.product, filter) && `${r.corridor ?? ''} ${r.incident_id} ${r.release_type}`.toLowerCase().includes(needle)),
  [incidents, filter, needle]);
  const maxScore = Math.max(1, ...(mode === 'corridors' ? ranking?.rows ?? [] : incidents?.rows ?? []).map((r) => r.score));

  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(id); }
  };
  const onIncidentKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIncidentId(id); }
  };

  return (
    <section id="priority" className="section container" aria-labelledby="priority-title">
      <SectionHeader id="priority-title" title="Top 15 Risk" />

      <div className="toolbar">
        <div className="toolbar__group">
          <Segmented<Mode> label="Ranking" value={mode} onChange={setMode} options={[
            { value: 'corridors', label: 'Corridors' },
            { value: 'incidents', label: 'Incidents' },
          ]} />
          <SearchInput value={query} onChange={setQuery} placeholder={mode === 'corridors' ? 'Search by town' : 'Search by town or incident'} />
          <Segmented<Filter> label="Product" value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All' }, { value: 'crude_oil', label: 'Crude oil' },
            { value: 'sour_gas', label: 'Sour gas' }, { value: 'sweet_gas', label: 'Sweet gas' },
          ]} />
        </div>
      </div>

      <div className={`table card${loading ? ' table--loading' : ''}`} role="table" aria-label={mode === 'corridors' ? 'Priority corridors' : 'Top incidents'} aria-busy={loading}>
          <div className={`table__row table__row--head${mode === 'incidents' ? ' table__row--incident' : ''}`} role="row">
            {(mode === 'corridors'
              ? ['#', 'Corridor', 'Product', 'Incidents', 'Consequence', 'Risk score', 'vs count-only', '']
              : ['#', 'Incident', 'Town', 'Product', 'Likelihood', 'Consequence', 'Risk score', '']
            ).map((h, i) => (
              <span key={i} role="columnheader" className="table__cell">{h}</span>
            ))}
          </div>
          {mode === 'corridors' ? rows.map((r) => {
            const shift = shiftLabel(r.rank, r.count_rank);
            return (
              <div key={r.id} className="table__row" role="row" tabIndex={0}
                aria-label={`Rank ${r.rank}, ${r.corridor}. Open corridor`}
                onClick={() => onOpen(r.id)} onKeyDown={(e) => onKey(e, r.id)}>
                <span className="table__cell" role="cell"><RankChip rank={r.rank} /></span>
                <span className="table__cell table__name" role="cell">
                  <strong>{r.corridor}</strong><span className="caption text-muted">Alberta</span>
                </span>
                <span className="table__cell" role="cell"><ProductLabel value={r.product} /></span>
                <span className="table__cell table__num" role="cell">{r.incidents}</span>
                <span className="table__cell" role="cell"><ConsequenceBadge value={r.consequence} /></span>
                <Score score={r.score} max={maxScore} color={consequenceColor[r.consequence]} />
                <span className="table__cell small" role="cell" style={{ color: shift.color, fontWeight: 500 }}>{shift.text}</span>
                <span className="table__cell table__chev" role="cell" aria-hidden="true">›</span>
              </div>
            );
          }) : incidentRows.map((r) => (
            <IncidentRow key={r.id} row={r} maxScore={maxScore} onOpen={setIncidentId} onKey={onIncidentKey} />
          ))}
          {!loading && (mode === 'corridors' ? rows : incidentRows).length === 0 && (
            <div className="table__empty">
              <strong>No {mode === 'corridors' ? 'corridors' : 'incidents'} match "{query}"</strong>
              <span className="small text-secondary">Try another town or clear the product filter.</span>
            </div>
          )}
      </div>

      <div className="table__note caption text-muted">
        {mode === 'corridors' ? (
          <span>Showing {rows.length} of {ranking?.total_corridors ?? '—'} corridors · {ranking?.unplaced ?? 0} incidents left out because the nearest town was missing or unusable</span>
        ) : (
          <span>Showing {incidentRows.length} of {incidents?.scored ?? '—'} scored Alberta incidents. A release with no consequence is left out.</span>
        )}
        <span>Last refreshed {ranking ? new Date(ranking.generated_at).toLocaleDateString('en-CA', { dateStyle: 'medium', timeZone: 'UTC' }) : '—'}</span>
      </div>
      {opened ? <IncidentDrawer item={opened} onClose={() => setIncidentId(null)} /> : null}
    </section>
  );
}

import type { RankingRow } from '../api/types';
import { productLabel } from '../api/labels';

/** Downloads the ranking as a CSV the field team can open in Excel. */
export function downloadRankingCsv(rows: RankingRow[]) {
  const header = ['Rank', 'Corridor', 'Product', 'Incidents', 'Risk score', 'Lat', 'Lng'];
  const lines = rows.map((r) => [
    r.rank, r.corridor, productLabel[r.product], r.incidents,
    r.score, r.centroid.lat, r.centroid.lng,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `corridorwatch-top${rows.length}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

import { Button } from '../components/ui';

export function CtaBand({ onExport, onMap }: { onExport: () => void; onMap: () => void }) {
  return (
    <section className="container cta-wrap">
      <div className="cta">
        <div>
          <h2 className="h2 cta__title">Plan your next inspection round</h2>
          <p className="text-secondary">Export the top 15 corridors as a CSV file for field planning.</p>
        </div>
        <div className="cta__actions">
          <Button onClick={onMap}>View on map</Button>
          <Button variant="primary" onClick={onExport}>Export list</Button>
        </div>
      </div>
    </section>
  );
}

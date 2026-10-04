import { SectionHeader } from '../components/ui';

export function MethodSection() {
  return (
    <section id="method" className="section section--open container" aria-labelledby="method-title">
      <SectionHeader id="method-title" title="One score, two questions"
        sub="Every corridor gets a risk score that combines its track record with what is at stake." />
      <div className="method__row">
        <article className="method__card">
          <h3>Likelihood</h3>
          <p className="method__q">How strongly does the history point here?</p>
          <p className="small text-secondary">The same 1–5 as the map, from reported age, a neighbor under 100 m, and never inspected.</p>
        </article>
        <span className="method__op" aria-hidden="true">×</span>
        <article className="method__card">
          <h3>Consequence</h3>
          <p className="method__q">How bad was the release?</p>
          <p className="small text-secondary">The same 1–5 as the map, from the release, a short or long interruption, elevated density, and natural force.</p>
        </article>
        <span className="method__op" aria-hidden="true">=</span>
        <article className="method__card method__card--result">
          <h3>Risk score</h3>
          <p className="method__q">Where should crews go first?</p>
          <p className="small text-secondary">Likelihood times consequence. A town’s score is the sum of those products. An incident with no consequence adds nothing.</p>
        </article>
      </div>
      <div className="method__note" role="note">
        CorridorWatch ranks historical incident hotspots to prioritize inspections. It doesn’t certify any pipe as safe and isn’t a repair design.
      </div>
    </section>
  );
}

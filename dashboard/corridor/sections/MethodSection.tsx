import { SectionHeader } from '../components/ui';

export function MethodSection() {
  return (
    <section id="method" className="section section--open container" aria-labelledby="method-title">
      <SectionHeader id="method-title" title="One score, two questions"
        sub="Every corridor receives a risk score that combines historical failure patterns with potential consequence." />
      <div className="method__row">
        <article className="method__card">
          <h3>Likelihood</h3>
          <p className="method__q">How likely is an incident?</p>
          <p className="small text-secondary">Scores range from 1 to 5 based on incident age, neighboring incidents within 100 metres, and inspection history.</p>
        </article>
        <span className="method__op" aria-hidden="true">×</span>
        <article className="method__card">
          <h3>Consequence</h3>
          <p className="method__q">What is the severity of a release?</p>
          <p className="small text-secondary">Scores range from 1 to 5 based on release volume and substance, combined with facility criticality and groundwater vulnerability. Lower secondary scores do not reduce the release score.</p>
        </article>
        <span className="method__op" aria-hidden="true">=</span>
        <article className="method__card method__card--result">
          <h3>Risk score</h3>
          <p className="method__q">Which locations require priority inspection?</p>
          <p className="small text-secondary">Risk is likelihood multiplied by consequence. A town score sums the risk of its incidents. Incidents without consequence scores do not add to the total.</p>
        </article>
      </div>
      <div className="method__note" role="note">
        CorridorWatch ranks historical incident hotspots to prioritize inspections. It does not certify pipeline safety and is not an engineering repair plan.
      </div>
    </section>
  );
}

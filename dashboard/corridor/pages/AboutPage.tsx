import Link from 'next/link';
import { SectionHeader } from '../components/ui';
import './about.css';

const PROBLEMS = [
  { title: 'Inspection capacity is limited', body: 'Integrity teams have limited field hours each season. Inspections need to target the highest risks.' },
  { title: 'A town score is a sum', body: 'Each incident is scored as likelihood times consequence. A town score sums those incident risk values.' },
  { title: 'Release consequence matters', body: 'A crude oil or sour gas release near a populated area carries higher consequence than a small sweet gas leak. The scoring reflects those differences.' },
];

export function AboutPage() {
  return (
    <>
      <section className="container about-hero">
        <h1 className="about-hero__title">Pipeline risk ranking for inspection planning</h1>
        <p className="about-hero__sub">
          CorridorWatch converts public Canada Energy Regulator incident records into a prioritized inspection list. Likelihood measures failure history, and consequence measures potential impact.
        </p>
      </section>

      <section className="section section--band">
        <div className="container">
          <SectionHeader title="Why risk ranking matters" />
          <ol className="problem-list">
            {PROBLEMS.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p className="small text-secondary">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container cta-wrap">
        <div className="cta">
          <div>
            <h2 className="h2 cta__title">Inspect the priority corridors</h2>
            <p className="text-secondary">Fifteen corridors ranked by risk score, mapped and available for export.</p>
          </div>
          <Link href="/#priority" className="btn btn--primary">View priority list</Link>
        </div>
      </section>
    </>
  );
}

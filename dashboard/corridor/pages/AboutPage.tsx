import Link from 'next/link';
import { SectionHeader } from '../components/ui';
import './about.css';

const PROBLEMS = [
  { title: 'Crews are limited', body: 'Integrity teams can only walk so many kilometres a season. Every visit has to count.' },
  { title: 'Counts mislead', body: 'The corridors with the most incidents are often low-consequence. Counting alone sends crews to noise.' },
  { title: 'Consequence is missing', body: 'A sour-gas or crude release near a town matters more than a small sweet-gas puff. Rankings should say so.' },
];

export function AboutPage() {
  return (
    <>
      <section className="container about-hero">
        <h1 className="about-hero__title">Built for crews with more pipe than hours</h1>
        <p className="about-hero__sub">
          We turn the CER’s public incident record into a ranked inspection list. Likelihood tells you where pipe has failed.
          Consequence tells you where failure would hurt most. Together they tell you where to go first.
        </p>
      </section>

      <section className="section section--band">
        <div className="container">
          <SectionHeader title="Why a better list matters" />
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
            <h2 className="h2 cta__title">See the priority list</h2>
            <p className="text-secondary">Fifteen corridors, ranked by real risk, each one on the map.</p>
          </div>
          <Link href="/#priority" className="btn btn--primary">View priority list</Link>
        </div>
      </section>
    </>
  );
}

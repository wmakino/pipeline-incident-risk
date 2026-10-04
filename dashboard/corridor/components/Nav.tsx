import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { onTransitionClick } from '@/lib/page-transition';
import { Logo, Segmented } from './ui';
import { useTheme, type Theme } from '../hooks/useTheme';
import './Nav.css';

const SECTIONS = [
  { id: 'priority', label: 'Inspect list' },
  { id: 'method', label: 'Method' },
];

export function Nav() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<string>('priority');

  useEffect(() => {
    if (pathname !== '/') return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [pathname]);

  const goTo = (id: string) => {
    if (pathname !== '/') {
      window.location.assign(`/#${id}`);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  return (
    <header className="mast">
      <div className="container mast__top">
        <div className="mast__identity">
          <Link href="/" aria-label="CorridorWatch home"><Logo /></Link>
          <p className="mast__asof">As of 25 Sep 2026</p>
        </div>
        <Segmented<Theme> pill label="Theme" value={theme} onChange={setTheme}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
      </div>
      <div className="container">
        <nav className="mast__nav" aria-label="Main">
          <ul className="mast__links">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" className="mast__link"
                  aria-current={pathname === '/' && active === s.id ? 'true' : undefined}
                  onClick={() => goTo(s.id)}>
                  {s.label}
                </button>
              </li>
            ))}
            <li>
              <Link href="/incidents" className="mast__link" aria-current={pathname === '/incidents' ? 'page' : undefined} onClick={onTransitionClick(router, '/incidents')}>Incidents</Link>
            </li>
            <li>
              <Link href="/map" className="mast__link" aria-current={pathname === '/map' ? 'page' : undefined} onClick={onTransitionClick(router, '/map')}>Map</Link>
            </li>
            <li>
              <Link href="/about" className="mast__link" aria-current={pathname === '/about' ? 'page' : undefined}>About</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

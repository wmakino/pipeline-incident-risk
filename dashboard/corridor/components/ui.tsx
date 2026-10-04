import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import type { Product } from '../api/types';
import { productColor, productLabel } from '../api/labels';
import './ui.css';

type BtnVariant = 'primary' | 'secondary' | 'ghost';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'md' | 'sm'; icon?: boolean;
}
/** Rule: max one `primary` per view. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className = '', ...rest }, ref,
) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', icon && 'btn--icon', className].filter(Boolean).join(' ');
  return <button ref={ref} type="button" className={cls} {...rest} />;
});

export function Badge({ color, children, size }: { color: string; children: ReactNode; size?: 'sm' }) {
  return (
    <span className={`badge${size === 'sm' ? ' badge--sm' : ''}`} style={{ '--badge-color': color } as CSSProperties}>
      {children}
    </span>
  );
}

export const Dot = ({ color, size = 8 }: { color: string; size?: number }) => (
  <span className="dot" style={{ '--dot-color': color, width: size, height: size } as CSSProperties} aria-hidden="true" />
);

export const ProductLabel = ({ value }: { value: Product }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <Dot color={productColor[value]} />
    {productLabel[value]}
  </span>
);

export function Segmented<T extends string | number>({
  options, value, onChange, label, pill,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; pill?: boolean }) {
  return (
    <div className={`segmented${pill ? ' segmented--pill' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="segmented__option"
          aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export const RankChip = ({ rank }: { rank: number }) => (
  <span className={`rank-chip${rank <= 3 ? ' rank-chip--top' : ''}`}>{rank}</span>
);

export function SectionHeader({ title, sub, id }: { title: string; sub?: string; id?: string }) {
  return (
    <header className="section-header">
      <h2 className="h2" id={id}>{title}</h2>
      {sub && <p>{sub}</p>}
    </header>
  );
}

export const Logo = () => (
  <span className="logo">
    <span className="logo__mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 12c3 0 3-6 7-6s4 6 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="6" r="2" fill="currentColor" />
      </svg>
    </span>
    CorridorWatch
  </span>
);

export const StatTile = ({ value, label, color }: { value: string; label: string; color?: string }) => (
  <div className="stat-tile">
    <span className="stat-tile__value" style={{ color }}>{value}</span>
    <span className="stat-tile__label">{label}</span>
  </div>
);

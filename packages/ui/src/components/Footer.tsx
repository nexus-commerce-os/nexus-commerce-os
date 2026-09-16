import type { ReactNode } from 'react';
import { Brand } from './Brand';

export type FooterLink = { label: string; href: string };
export type FooterColumn = { heading: string; links: FooterLink[] };

export type FooterProps = {
  /** Tagline under the brand. */
  note: ReactNode;
  columns: FooterColumn[];
  bottomLeft: ReactNode;
  bottomRight: ReactNode;
};

/** Config-driven site footer: brand + note, link columns, and a bottom bar. */
export function Footer({ note, columns, bottomLeft, bottomRight }: FooterProps) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Brand />
            <p className="foot-note">{note}</p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              {/* h3: the preceding section heading is an h2, so h4 would skip a level */}
              <h3>{col.heading}</h3>
              {col.links.map((l) => (
                <a key={`${l.label}:${l.href}`} href={l.href}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>{bottomLeft}</span>
          <span className="mono">{bottomRight}</span>
        </div>
      </div>
    </footer>
  );
}

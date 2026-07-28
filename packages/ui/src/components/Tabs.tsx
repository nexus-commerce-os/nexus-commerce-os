'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { id: string; label: string; content: ReactNode };

export type TabsProps = {
  tabs: Tab[];
  /** Id of the initially-active tab (defaults to the first). */
  initial?: string;
};

/** Accessible tabbed panel (`.tabs`). The only interactive @nexus/ui primitive. */
export function Tabs({ tabs, initial }: TabsProps) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? 'tab tab-active' : 'tab'}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="tab-panel" role="tabpanel">
        {current ? current.content : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

export interface CategoryOption {
  value: string;
  label: string;
  group: string;
}

interface CategoryMultiSelectProps {
  options: CategoryOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  triggerLabel?: string;
}

export default function CategoryMultiSelect({ options, selected, onChange, triggerLabel = 'Category' }: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const groups = [...new Set(options.map(o => o.group))];

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`db-pill${selected.size > 0 ? ' db-pill-active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {triggerLabel}{selected.size > 0 ? ` (${selected.size})` : ''} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
            minWidth: '260px', maxHeight: '360px', overflowY: 'auto',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', padding: '0.65rem 0.75rem',
          }}
          onClick={e => e.stopPropagation()}
        >
          {groups.map(g => (
            <div key={g}>
              <div className="events-detail-h4" style={{ marginTop: '0.5rem' }}>{g}</div>
              {options.filter(o => o.group === g).map(o => (
                <label
                  key={o.value}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0', fontSize: '0.83rem', cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          ))}
          {selected.size > 0 && (
            <button
              type="button"
              className="leg-pill"
              style={{ marginTop: '0.6rem' }}
              onClick={() => onChange(new Set())}
            >
              Clear ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

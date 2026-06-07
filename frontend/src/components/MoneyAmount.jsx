import { useState, useCallback, useMemo, useEffect } from 'react';

// ── MoneyAmount ───────────────────────────────────────────────────────────────
// A small wrapper around any displayed money value. Renders a 👁/🙈 toggle
// next to the formatted amount and defaults to *hidden* — protecting
// screen-shoulder-surfing in offices and on shared screen shares.
//
//   <MoneyAmount value={75000} />                              // uses prefix ₹
//   <MoneyAmount value={75000} prefix="₹" />                   // explicit prefix
//   <MoneyAmount value={null} />                               // shows em-dash
//   <MoneyAmount value={payslip.netPay} align="right" />       // tabular right-align
//   <MoneyAmount value={salary} scope="global" key="hr-payroll" />  // shared
//
// Visibility is scoped:
//   - default (no `scope` prop): per-instance local state — clicking one
//     MoneyAmount reveals only that one.
//   - scope="row": parent supplies a `rowId` prop; the parent owns the
//     revealed-rows Set, so a single toggle can reveal an entire row's amounts.
//   - scope="global": visibility is shared with every other MoneyAmount on
//     the same page that uses the same `key` prop. State is persisted in
//     localStorage under the key `fwc.money.hidden.<key>` so a user who
//     reveals payroll once doesn't have to re-click on every visit.
//
// Hidden state shows `•• ••• •••` instead of the actual value — close enough
// to the rendered shape that the row doesn't visually jump when revealed.
const MoneyAmount = ({
  value,
  prefix = '₹',
  align = 'left',
  scope,
  key: storageKey,
  rowId,
  fallback = '—',
  className = '',
}) => {
  // ── Visibility state ──────────────────────────────────────────────────────
  // We delegate to small helpers so the three scopes share a common shape.
  const [localRevealed, setLocalRevealed] = useState(false);
  const [globalRevealed, setGlobalRevealed] = useState(() => {
    if (scope !== 'global' || !storageKey) return false;
    try {
      return localStorage.getItem(`fwc.money.hidden.${storageKey}`) !== 'true';
    } catch { return false; }
  });

  // The parent (a row in a table) drives row-scoped visibility. We accept
  // either a boolean (simple) or a Set/Array of revealed rowIds.
  // The parent passes `rowId` and a `rowScopeRevealed` boolean to coordinate.
  // For simplicity, `scope="row"` is controlled by the parent — see Payroll
  // for the pattern; we read it from a window event the parent dispatches.

  // Persist the global scope's preference.
  useEffect(() => {
    if (scope !== 'global' || !storageKey) return;
    try {
      localStorage.setItem(
        `fwc.money.hidden.${storageKey}`,
        globalRevealed ? 'false' : 'true'
      );
    } catch { /* private mode etc. — ignore */ }
  }, [scope, storageKey, globalRevealed]);

  // For scope="row", listen for a custom event so a parent can flip the row
  // without prop-drilling. The parent dispatches `fwc:money:row` with
  // { rowId, revealed } detail.
  const [rowRevealed, setRowRevealed] = useState(false);
  useEffect(() => {
    if (scope !== 'row' || !rowId) return;
    const handler = (e) => {
      if (e.detail?.rowId === rowId) setRowRevealed(Boolean(e.detail.revealed));
    };
    window.addEventListener('fwc:money:row', handler);
    return () => window.removeEventListener('fwc:money:row', handler);
  }, [scope, rowId]);

  const isRevealed = useMemo(() => {
    if (scope === 'global') return globalRevealed;
    if (scope === 'row')    return rowRevealed;
    return localRevealed;
  }, [scope, globalRevealed, rowRevealed, localRevealed]);

  const toggle = useCallback(() => {
    if (scope === 'global') setGlobalRevealed(v => !v);
    else if (scope === 'row') {
      const next = !rowRevealed;
      setRowRevealed(next);
      // Also notify siblings on the same row so they update in sync.
      window.dispatchEvent(new CustomEvent('fwc:money:row', {
        detail: { rowId, revealed: next },
      }));
    }
    else setLocalRevealed(v => !v);
  }, [scope, rowRevealed, rowId]);

  // ── Formatting ────────────────────────────────────────────────────────────
  const hasValue = value != null && value !== '' && !Number.isNaN(Number(value));
  const formatted = useMemo(() => {
    if (!hasValue) return fallback;
    // Indian numbering: 1,00,000 instead of 100,000
    return Number(value).toLocaleString('en-IN');
  }, [value, hasValue, fallback]);

  // Hidden placeholder — same digit-count shape as the formatted number so
  // the row doesn't reflow when toggled. We render one bullet per thousands
  // group, with a leading "₹" so the cell still looks like a money cell.
  const masked = useMemo(() => {
    if (!hasValue) return fallback;
    const numStr = String(Math.abs(Math.round(Number(value))));
    const groups = Math.ceil(numStr.length / 3) || 1;
    return '•'.repeat(groups) + ' •••';
  }, [value, hasValue, fallback]);

  const wrapperStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
  };

  const amountStyle = {
    fontVariantNumeric: 'tabular-nums',
    color: hasValue ? 'inherit' : '#44445a',
  };

  return (
    <span style={wrapperStyle} className={`money-amount ${className}`}>
      <span style={amountStyle} className="money-amount-value">
        {prefix && hasValue ? prefix : ''}
        {isRevealed || !hasValue ? formatted : masked}
      </span>
      {hasValue && (
        <button
          type="button"
          onClick={toggle}
          className={`money-amount-toggle ${isRevealed ? 'revealed' : 'hidden'}`}
          aria-label={isRevealed ? 'Hide amount' : 'Show amount'}
          aria-pressed={isRevealed}
          title={isRevealed ? 'Hide amount' : 'Show amount'}
        >
          {/* Inline SVG so the icon renders crisply at any size and across
              all platforms — emoji rendering varies too much to rely on. */}
          {isRevealed ? (
            // Eye-off icon — "currently visible, click to hide"
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 4 10 6a14 14 0 0 1-3.1 4" />
              <path d="M6.6 6.6A14 14 0 0 0 2 12c1 2 5 6 10 6a9.7 9.7 0 0 0 4.4-1" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
          ) : (
            // Eye icon — "currently hidden, click to reveal"
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </span>
  );
};

// ── Companion hook for parents using scope="row" or scope="global" ──────────
// Lives in src/hooks/useMoneyVisibility.js — see that file. Keeping it out of
// this file lets fast-refresh work cleanly: this module only exports React
// components, as required by the react-refresh ESLint rule.

export default MoneyAmount;


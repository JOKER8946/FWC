import { useState, useCallback } from 'react';

// ── useMoneyVisibility ────────────────────────────────────────────────────────
// Companion hook for parents that render many <MoneyAmount /> children and
// want to coordinate their visibility (e.g. revealing every amount in a
// table at once, or toggling all amounts on a single row together).
//
// Returns:
//   - toggleRow(rowId): flip a row's visibility, notifying all sibling
//     MoneyAmounts on that row to update in sync (via a window event).
//   - revealAll(rowIds) / hideAll(rowIds): bulk reveal/hide.
//   - isRowRevealed(rowId): synchronous read of current state.
//   - revealedRows: the Set of currently-revealed rowIds (for advanced use).
//   - setRevealedRows / initial: escape hatches.
//
// The window-event coordination lets children avoid prop-drilling — see
// MoneyAmount's `scope="row"` mode for the listener side.
const useMoneyVisibility = (initial = false) => {
  const [revealedRows, setRevealedRows] = useState(() => new Set());

  const toggleRow = useCallback((rowId) => {
    setRevealedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else                  next.add(rowId);
      window.dispatchEvent(new CustomEvent('fwc:money:row', {
        detail: { rowId, revealed: next.has(rowId) },
      }));
      return next;
    });
  }, []);

  const broadcast = useCallback((rowIds, revealed) => {
    rowIds.forEach(rid => window.dispatchEvent(new CustomEvent('fwc:money:row', {
      detail: { rowId: rid, revealed },
    })));
  }, []);

  const revealAll = useCallback((rowIds) => {
    broadcast(rowIds, true);
    setRevealedRows(new Set(rowIds));
  }, [broadcast]);

  const hideAll = useCallback((rowIds) => {
    broadcast(rowIds, false);
    setRevealedRows(new Set());
  }, [broadcast]);

  const isRowRevealed = useCallback((rowId) => revealedRows.has(rowId), [revealedRows]);

  return { toggleRow, revealAll, hideAll, isRowRevealed, revealedRows, setRevealedRows, initial };
};

export default useMoneyVisibility;

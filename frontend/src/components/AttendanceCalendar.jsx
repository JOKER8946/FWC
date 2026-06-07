import { useMemo, useState } from 'react';
import {
  isWeekend, isHoliday,
  getHoliday, getEvents, isoDate, SUPPORTED_YEARS,
} from '../data/calendarData';

// ── AttendanceCalendar ───────────────────────────────────────────────────────
// A full month-grid calendar with:
//   - prev/next month + year navigation (keyboard accessible)
//   - jump-to-month + jump-to-year pickers
//   - 3-year view: any year between SUPPORTED_YEARS[0] and last
//   - per-day status from attendance records (present/late/absent/wfh/half-day)
//   - holiday marker (national/religious/regional) and event marker (company/team)
//   - working-day indicator (Mon–Sat, with Sunday + holidays flagged as non-working)
//   - click a day to open a detail popup with check-in/out + holiday + events
//
// Replaces the previous "last 30 days" tile grid.

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Visual treatment per attendance status.
const STATUS_COLOR = {
  present:    '#10b981',
  late:       '#f59e0b',
  absent:     '#ef4444',
  wfh:        '#6366f1',
  'half-day': '#a78bfa',
  holiday:    '#555570',
};

// Color codes for markers — chosen to harmonize with the dark UI.
const KIND_COLOR = {
  national:  '#ef4444',   // red — gazetted public holiday
  religious: '#a78bfa',   // purple — religious observances
  regional:  '#f59e0b',   // amber — regional/optional
  company:   '#6366f1',   // indigo — company-wide events
  team:      '#10b981',   // green — team-level events
};

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtHours = (h) => h ? `${h}h` : '—';

export default function AttendanceCalendar({ records = [] }) {
  // Stable "today" — recompute once per mount, not on every render, so the
  // downstream useMemo (cells, counts) doesn't see a fresh Date each time.
  const today = useMemo(() => new Date(), []);
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null);

  // Clamp year to the supported range so the picker can't navigate to a year
  // we have no holiday data for. We don't store the clamped year as state —
  // we derive the effective year inline and use it everywhere instead.
  const minYear = SUPPORTED_YEARS[0];
  const maxYear = SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];
  const effYear = Math.max(minYear, Math.min(maxYear, year));

  // O(1) lookup of attendance records by ISO date.
  const recordByDate = useMemo(() => {
    const map = {};
    records.forEach(r => {
      if (!r.date) return;
      const d = new Date(r.date);
      const key = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
      map[key] = r;
    });
    return map;
  }, [records]);

  // 6 rows × 7 cols is the maximum any month can render. We pad start + end
  // with blanks so the grid lines up neatly.
  const cells = useMemo(() => {
    const firstDay = new Date(effYear, month, 1);
    const startWeekday = firstDay.getDay();           // 0 = Sun
    const daysInMonth = new Date(effYear, month + 1, 0).getDate();

    const arr = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(effYear, month, d));
    // Trailing blanks to fill the last row
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [effYear, month]);

  // Aggregate counts for the visible month — shown in the summary chips.
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, wfh: 0, holiday: 0, workingDays: 0, nonWorking: 0 };
    cells.forEach(cell => {
      if (!cell) return;
      const key = isoDate(cell.getFullYear(), cell.getMonth(), cell.getDate());
      const rec = recordByDate[key];
      // Default status logic: future = none, past & no record = absent
      let status = rec?.status;
      if (!status) {
        const isPast = cell <= new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (isPast)  status = isHoliday(...[cell.getFullYear(), cell.getMonth(), cell.getDate()]) ? 'holiday' : 'absent';
      }
      if (status && c[status] !== undefined) c[status]++;

      // Working day count
      if (isWeekend(cell) || isHoliday(...[cell.getFullYear(), cell.getMonth(), cell.getDate()])) {
        c.nonWorking++;
      } else {
        c.workingDays++;
      }
    });
    return c;
  }, [cells, recordByDate, today]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const gotoPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => Math.max(minYear, y - 1)); }
    else              setMonth(m => m - 1);
  };
  const gotoNext = () => {
    if (month === 11) { setMonth(0); setYear(y => Math.min(maxYear, y + 1)); }
    else               setMonth(m => m + 1);
  };
  const gotoToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="atc-root">
      {/* Header bar — month + year nav + pickers */}
      <div className="atc-toolbar">
        <div className="atc-toolbar-left">
          <button className="atc-nav-btn" onClick={gotoPrev} aria-label="Previous month">‹</button>
          <div className="atc-month-label">{MONTHS[month]} {effYear}</div>
          <button className="atc-nav-btn" onClick={gotoNext} aria-label="Next month">›</button>
          <button className="atc-today-btn" onClick={gotoToday}>Today</button>
        </div>
        <div className="atc-toolbar-right">
          <select
            className="atc-picker"
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            aria-label="Jump to month"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            className="atc-picker"
            value={effYear}
            onChange={e => setYear(Number(e.target.value))}
            aria-label="Jump to year"
          >
            {SUPPORTED_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary chips — counts for the visible month */}
      <div className="atc-summary">
        {[
          ['Present',     counts.present,     '#10b981'],
          ['Late',        counts.late,        '#f59e0b'],
          ['Absent',      counts.absent,      '#ef4444'],
          ['WFH',         counts.wfh,         '#6366f1'],
          ['Holidays',    counts.holiday,     '#555570'],
          ['Working',     counts.workingDays, '#a5b4fc'],
          ['Non-working', counts.nonWorking,  '#7070a0'],
        ].map(([label, value, color]) => (
          <div key={label} className="atc-chip" style={{ borderColor: `${color}30`, background: `${color}12` }}>
            <div className="atc-chip-val" style={{ color }}>{value}</div>
            <div className="atc-chip-lbl" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Weekday header row */}
      <div className="atc-weekdays">
        {WEEKDAYS.map(w => <div key={w} className="atc-weekday">{w}</div>)}
      </div>

      {/* Day grid */}
      <div className="atc-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="atc-cell atc-cell-blank" />;

          const y = cell.getFullYear();
          const m = cell.getMonth();
          const d = cell.getDate();
          const key = isoDate(y, m, d);
          const rec = recordByDate[key];
          const holiday = getHoliday(y, m, d);
          const events  = getEvents(y, m, d);
          const isToday = cell.toDateString() === today.toDateString();
          const isPast  = cell < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const status  = rec?.status
            || (holiday ? 'holiday'
            : (isPast ? (isWeekend(cell) ? null : 'absent') : null));
          const color = STATUS_COLOR[status] || null;
          const isSel = selected && selected.toDateString() === cell.toDateString();

          const classes = ['atc-cell'];
          if (isToday) classes.push('atc-today');
          if (isSel)   classes.push('atc-selected');
          if (color)   classes.push('atc-has-status');
          if (events.length)    classes.push('atc-event');
          if (status === 'absent') classes.push('atc-absent');

          // A day is "marked" (gets the Sunday-style treatment) if it's a
          // Sunday *or* has a public holiday. Precedence: Sunday wins the
          // pill label, but the holiday name still shows in the detail
          // popup and the holiday dot still renders.
          const isSunday = isWeekend(cell);
          const markType = isSunday ? 'sun'
                         : holiday ? holiday.type    // 'national' | 'religious' | 'regional'
                         : null;
          if (markType) {
            classes.push('atc-cell-marked', `atc-mark-${markType}`);
          }

          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              onClick={() => setSelected(isSel ? null : cell)}
              style={color ? { '--cell-color': color } : undefined}
              aria-label={[
                cell.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                status, holiday?.name, ...events.map(e => e.name),
              ].filter(Boolean).join(' · ')}
            >
              {/* Marked day (Sunday or any public holiday) gets a corner
                  pill naming the kind, plus a circular day-number badge.
                  The pill label shortens the holiday type to 3 chars. */}
              {markType && (
                <span className="atc-cell-mark-pill">
                  {markType === 'sun'       ? 'SUN'
                   : markType === 'national' ? 'NAT'
                   : markType === 'religious'? 'REL'
                   : markType === 'regional' ? 'REG'
                   : ''}
                </span>
              )}

              {/* Day number — wrapped in a circular badge on marked days,
                  plain text on regular days. */}
              {markType ? (
                <span className="atc-cell-day-wrap">{d}</span>
              ) : (
                <div className="atc-cell-day">{d}</div>
              )}

              {/* Status pill (or dot for absent) — hidden on marked days
                  (CSS rule: .atc-cell-marked .atc-cell-status { display:none }).
                  On regular days it still shows PRE/LATE/WFH/½. */}
              {status && status !== 'absent' && (
                <div className="atc-cell-status" style={{ color }}>
                  {status === 'half-day' ? '½' : status === 'wfh' ? 'WFH' : status.slice(0, 3)}
                </div>
              )}

              {/* Holiday + event dots — kept on every day (including marked
                  ones) so e.g. "Sunday + Holi" is fully visible. */}
              {(holiday || events.length > 0) && (
                <div className="atc-cell-dots">
                  {holiday && <span className="atc-dot" style={{ background: KIND_COLOR[holiday.type] }} title={holiday.name} />}
                  {events.map((e, idx) => (
                    <span key={idx} className="atc-dot" style={{ background: KIND_COLOR[e.kind] }} title={e.name} />
                  ))}
                </div>
              )}
              {/* Today marker */}
              {isToday && <div className="atc-today-ring" />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="atc-legend">
        <div className="atc-legend-section">
          <span className="atc-legend-title">Status</span>
          {[['present','Present'],['late','Late'],['absent','Absent'],['wfh','WFH'],['half-day','Half-day']].map(([k, l]) => (
            <span key={k} className="atc-legend-item">
              <span className="atc-legend-swatch" style={{ background: STATUS_COLOR[k] }} />
              {l}
            </span>
          ))}
        </div>
        <div className="atc-legend-section">
          <span className="atc-legend-title">Marked days</span>
          {[
            ['sun',       'Sun',       'linear-gradient(135deg, #a855f7, #6366f1)'],
            ['national',  'National',  'linear-gradient(135deg, #ef4444, #b91c1c)'],
            ['religious', 'Religious', 'linear-gradient(135deg, #a78bfa, #6d28d9)'],
            ['regional',  'Regional',  'linear-gradient(135deg, #f59e0b, #b45309)'],
          ].map(([k, l, bg]) => (
            <span key={k} className="atc-legend-item">
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#fff',
                  background: bg,
                  borderRadius: 99,
                  textTransform: 'uppercase',
                }}
              >
                {k === 'sun' ? 'SUN' : k === 'national' ? 'NAT' : k === 'religious' ? 'REL' : 'REG'}
              </span>
              {l}
            </span>
          ))}
        </div>
        <div className="atc-legend-section">
          <span className="atc-legend-title">Events</span>
          {[['company','Company'],['team','Team']].map(([k, l]) => (
            <span key={k} className="atc-legend-item">
              <span className="atc-legend-dot" style={{ background: KIND_COLOR[k] }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Day-detail popup */}
      {selected && (() => {
        const y = selected.getFullYear();
        const m = selected.getMonth();
        const d = selected.getDate();
        const key = isoDate(y, m, d);
        const rec = recordByDate[key];
        const holiday = getHoliday(y, m, d);
        const events  = getEvents(y, m, d);
        const working = !isWeekend(selected) && !holiday;

        return (
          <div className="atc-detail">
            <div className="atc-detail-head">
              <div>
                <div className="atc-detail-date">
                  {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="atc-detail-meta">
                  {working ? '🟢 Working day' : '⛔ Non-working day'}
                  {holiday && <span> · 🎉 {holiday.name}</span>}
                </div>
              </div>
              <button className="atc-detail-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>

            {/* Attendance row */}
            {rec ? (
              <div className="atc-detail-row">
                <span><span className="atc-detail-key">Status</span> <span className="atc-detail-val" style={{ color: STATUS_COLOR[rec.status] }}>{rec.status}</span></span>
                <span><span className="atc-detail-key">In</span>      <span className="atc-detail-val" style={{ color: '#10b981' }}>{fmtTime(rec.checkIn)}</span></span>
                <span><span className="atc-detail-key">Out</span>     <span className="atc-detail-val" style={{ color: '#a5b4fc' }}>{fmtTime(rec.checkOut)}</span></span>
                <span><span className="atc-detail-key">Hours</span>   <span className="atc-detail-val">{fmtHours(rec.hoursWorked)}</span></span>
              </div>
            ) : (
              <div className="atc-detail-row">
                <span className="atc-detail-empty">No check-in recorded for this day.</span>
              </div>
            )}

            {/* Holidays list */}
            {holiday && (
              <div className="atc-detail-section">
                <div className="atc-detail-section-title" style={{ color: KIND_COLOR[holiday.type] }}>🎉 Holiday</div>
                <div className="atc-detail-section-body">{holiday.name} <span className="atc-detail-tag" style={{ background: `${KIND_COLOR[holiday.type]}22`, color: KIND_COLOR[holiday.type] }}>{holiday.type}</span></div>
              </div>
            )}

            {/* Events list */}
            {events.length > 0 && (
              <div className="atc-detail-section">
                <div className="atc-detail-section-title" style={{ color: '#a5b4fc' }}>📅 Events</div>
                {events.map((e, i) => (
                  <div key={i} className="atc-detail-section-body">
                    {e.name} <span className="atc-detail-tag" style={{ background: `${KIND_COLOR[e.kind]}22`, color: KIND_COLOR[e.kind] }}>{e.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

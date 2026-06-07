/**
 * Calendar data: Indian government public holidays + company events for
 * 2025, 2026, and 2027. All dates are local (Asia/Kolkata) — these are
 * public-holiday dates observed in India. Lunar dates (Eid, Diwali exact
 * day) are pinned to the gazetted dates; we'll update annually as the
 * government publishes the official list for the new year.
 *
 * Shape:
 *   - HOLIDAYS: { 'YYYY-MM-DD': { name, type: 'national' | 'religious' | 'regional' } }
 *   - EVENTS:   { 'YYYY-MM-DD': [{ name, kind: 'company' | 'team' | 'payday' | 'release' }] }
 *
 * Lookup is keyed by ISO date string so it's O(1) and survives timezone
 * round-trips.
 */

// ── Indian public holidays 2025, 2026, 2027 ─────────────────────────────────
// Source: Government of India gazette / RBI holiday list. Religious dates
// (Eid, Diwali, Holi) are pinned to the *observed* date, not the astronomical
// one — that's how most HR systems treat them for payroll purposes.
const HOLIDAYS = {
  // 2025
  '2025-01-26': { name: 'Republic Day',                  type: 'national' },
  '2025-02-26': { name: 'Maha Shivaratri',               type: 'religious' },
  '2025-03-14': { name: 'Holi',                          type: 'religious' },
  '2025-03-31': { name: 'Id-ul-Fitr (Eid)',              type: 'religious' },
  '2025-04-14': { name: 'Dr. Ambedkar Jayanti',          type: 'national' },
  '2025-04-18': { name: 'Good Friday',                   type: 'religious' },
  '2025-05-01': { name: 'May Day / Labour Day',          type: 'national' },
  '2025-05-12': { name: 'Buddha Purnima',                type: 'religious' },
  '2025-06-07': { name: 'Id-ul-Adha (Bakrid)',           type: 'religious' },
  '2025-08-15': { name: 'Independence Day',              type: 'national' },
  '2025-08-16': { name: 'Parsi New Year',                type: 'regional' },
  '2025-08-27': { name: 'Ganesh Chaturthi',              type: 'religious' },
  '2025-10-02': { name: 'Gandhi Jayanti / Dussehra',     type: 'national' },
  '2025-10-20': { name: 'Diwali',                        type: 'religious' },
  '2025-10-21': { name: 'Govardhan Puja',                type: 'religious' },
  '2025-11-05': { name: 'Guru Nanak Jayanti',            type: 'religious' },
  '2025-12-25': { name: 'Christmas Day',                 type: 'national' },

  // 2026
  '2026-01-26': { name: 'Republic Day',                  type: 'national' },
  '2026-02-15': { name: 'Maha Shivaratri',               type: 'religious' },
  '2026-03-04': { name: 'Holi',                          type: 'religious' },
  '2026-03-20': { name: 'Id-ul-Fitr (Eid)',              type: 'religious' },
  '2026-04-03': { name: 'Good Friday',                   type: 'religious' },
  '2026-04-14': { name: 'Dr. Ambedkar Jayanti',          type: 'national' },
  '2026-05-01': { name: 'May Day / Labour Day',          type: 'national' },
  '2026-05-20': { name: 'Buddha Purnima',                type: 'religious' },
  '2026-05-27': { name: 'Id-ul-Adha (Bakrid)',           type: 'religious' },
  '2026-08-15': { name: 'Independence Day',              type: 'national' },
  '2026-09-14': { name: 'Ganesh Chaturthi',              type: 'religious' },
  '2026-10-02': { name: 'Gandhi Jayanti',                type: 'national' },
  '2026-10-19': { name: 'Dussehra',                      type: 'religious' },
  '2026-11-08': { name: 'Diwali',                        type: 'religious' },
  '2026-11-25': { name: 'Guru Nanak Jayanti',            type: 'religious' },
  '2026-12-25': { name: 'Christmas Day',                 type: 'national' },

  // 2027
  '2027-01-26': { name: 'Republic Day',                  type: 'national' },
  '2027-03-06': { name: 'Maha Shivaratri',               type: 'religious' },
  '2027-03-22': { name: 'Holi',                          type: 'religious' },
  '2027-03-09': { name: 'Id-ul-Fitr (Eid)',              type: 'religious' },
  '2027-03-26': { name: 'Good Friday',                   type: 'religious' },
  '2027-04-14': { name: 'Dr. Ambedkar Jayanti',          type: 'national' },
  '2027-05-01': { name: 'May Day / Labour Day',          type: 'national' },
  '2027-05-20': { name: 'Buddha Purnima',                type: 'religious' },
  '2027-05-17': { name: 'Id-ul-Adha (Bakrid)',           type: 'religious' },
  '2027-08-15': { name: 'Independence Day',              type: 'national' },
  '2027-09-04': { name: 'Ganesh Chaturthi',              type: 'religious' },
  '2027-10-02': { name: 'Gandhi Jayanti',                type: 'national' },
  '2027-10-08': { name: 'Dussehra',                      type: 'religious' },
  '2027-10-28': { name: 'Diwali',                        type: 'religious' },
  '2027-11-14': { name: 'Guru Nanak Jayanti',            type: 'religious' },
  '2027-12-25': { name: 'Christmas Day',                 type: 'national' },
};

// ── Company events 2025, 2026, 2027 ─────────────────────────────────────────
// Recurring calendar events: quarterly all-hands, monthly payday, hackathon
// weeks, release days, team outings. Not full CRUD yet (can be added later);
// for now this is the source of truth that an admin can later override.
const EVENTS = {
  // 2025
  '2025-01-01': [{ name: 'New Year — Office Closed',     kind: 'company' }],
  '2025-01-31': [{ name: 'Q4 All-Hands Meeting',         kind: 'company' }],
  '2025-02-14': [{ name: 'Hackathon Kickoff',            kind: 'team'    }],
  '2025-04-15': [{ name: 'Q1 All-Hands Meeting',         kind: 'company' }],
  '2025-04-25': [{ name: 'Annual Day — Office Outing',   kind: 'team'    }],
  '2025-07-15': [{ name: 'Q2 All-Hands Meeting',         kind: 'company' }],
  '2025-08-30': [{ name: 'Team Outing',                  kind: 'team'    }],
  '2025-10-15': [{ name: 'Q3 All-Hands Meeting',         kind: 'company' }],
  '2025-12-19': [{ name: 'Annual Hackathon Week',        kind: 'team'    }],
  '2025-12-31': [{ name: 'Year-End Wrap-up',             kind: 'company' }],

  // 2026
  '2026-01-01': [{ name: 'New Year — Office Closed',     kind: 'company' }],
  '2026-01-30': [{ name: 'Q4 All-Hands Meeting',         kind: 'company' }],
  '2026-03-13': [{ name: 'Hackathon Kickoff',            kind: 'team'    }],
  '2026-04-15': [{ name: 'Q1 All-Hands Meeting',         kind: 'company' }],
  '2026-04-24': [{ name: 'Annual Day — Office Outing',   kind: 'team'    }],
  '2026-07-15': [{ name: 'Q2 All-Hands Meeting',         kind: 'company' }],
  '2026-08-29': [{ name: 'Team Outing',                  kind: 'team'    }],
  '2026-10-15': [{ name: 'Q3 All-Hands Meeting',         kind: 'company' }],
  '2026-12-18': [{ name: 'Annual Hackathon Week',        kind: 'team'    }],
  '2026-12-31': [{ name: 'Year-End Wrap-up',             kind: 'company' }],

  // 2027
  '2027-01-01': [{ name: 'New Year — Office Closed',     kind: 'company' }],
  '2027-01-29': [{ name: 'Q4 All-Hands Meeting',         kind: 'company' }],
  '2027-03-12': [{ name: 'Hackathon Kickoff',            kind: 'team'    }],
  '2027-04-15': [{ name: 'Q1 All-Hands Meeting',         kind: 'company' }],
  '2027-04-23': [{ name: 'Annual Day — Office Outing',   kind: 'team'    }],
  '2027-07-15': [{ name: 'Q2 All-Hands Meeting',         kind: 'company' }],
  '2027-08-28': [{ name: 'Team Outing',                  kind: 'team'    }],
  '2027-10-15': [{ name: 'Q3 All-Hands Meeting',         kind: 'company' }],
  '2027-12-17': [{ name: 'Annual Hackathon Week',        kind: 'team'    }],
  '2027-12-31': [{ name: 'Year-End Wrap-up',             kind: 'company' }],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

// Indian weekend rule: only Sunday is a non-working day. Saturday is a
// regular working day for most companies (including this one, judging by the
// seed data's `isWeekend` helper which treats Sun as the only non-working day).
// Holidays override any day-of-week.
const isWeekend = (d) => d.getDay() === 0; // Sunday only

const isHoliday = (y, m, d) => Boolean(HOLIDAYS[isoDate(y, m, d)]);
const isEvent   = (y, m, d) => Boolean(EVENTS[isoDate(y, m, d)]);

const getHoliday = (y, m, d) => HOLIDAYS[isoDate(y, m, d)] || null;
const getEvents  = (y, m, d) => EVENTS[isoDate(y, m, d)]   || [];

// Get the long list of years the calendar supports — used by the year picker.
const SUPPORTED_YEARS = (() => {
  const years = new Set();
  Object.keys(HOLIDAYS).forEach(k => years.add(Number(k.slice(0, 4))));
  Object.keys(EVENTS).forEach(k => years.add(Number(k.slice(0, 4))));
  return [...years].sort();
})();

export {
  HOLIDAYS,
  EVENTS,
  isWeekend,
  isHoliday,
  isEvent,
  getHoliday,
  getEvents,
  isoDate,
  SUPPORTED_YEARS,
};

/**
 * Generates synthetic labeled training data for the Flight Risk neural network.
 *
 * Each sample has 8 normalized input features and 1 output (riskScore 0-1).
 *
 * Feature definitions:
 *  [0] attendanceDrop        - attendance drop vs previous period (0=none, 1=severe)
 *  [1] promotionStagnation   - days since last promotion / 730  (0=recent, 1=2+ years)
 *  [2] hikeStagnation        - days since last hike / 730
 *  [3] performanceDeclining  - 0 or 1 (is trend declining)
 *  [4] lowPerformanceScore   - 1 - (avgScore/100)  (inverted: 1=very poor)
 *  [5] leaveSpike            - 0 or 1 (recent leave frequency increased)
 *  [6] absenceRate           - recent absences / 10 (capped at 1)
 *  [7] shortTenure           - 1 if < 180 days tenure (honeymoon risk)
 */

const rand  = (min, max) => Math.random() * (max - min) + min;
const coin  = (prob)     => Math.random() < prob ? 1 : 0;
const clamp = (v)        => Math.min(1, Math.max(0, v));
const noise = (v, amt=0.06) => clamp(v + rand(-amt, amt));

const generateSample = (profile) => {
  const p = profile;
  return {
    input: {
      attendanceDrop:      noise(rand(p.attDrop[0],    p.attDrop[1])),
      promotionStagnation: noise(rand(p.promoStag[0],  p.promoStag[1])),
      hikeStagnation:      noise(rand(p.hikeStag[0],   p.hikeStag[1])),
      performanceDeclining:coin(p.declineProb),
      lowPerformanceScore: noise(rand(p.lowPerf[0],    p.lowPerf[1])),
      leaveSpike:          coin(p.leaveProb),
      absenceRate:         noise(rand(p.absence[0],    p.absence[1])),
      shortTenure:         coin(p.shortTenureProb),
    },
    output: { riskScore: clamp(rand(p.risk[0], p.risk[1]) + rand(-0.05, 0.05)) },
  };
};

// ── Risk profiles ─────────────────────────────────────────────────────────────
const PROFILES = [
  {
    name: 'star_employee',
    count: 200,
    attDrop:        [0.00, 0.05],
    promoStag:      [0.00, 0.20],
    hikeStag:       [0.00, 0.20],
    declineProb:    0.02,
    lowPerf:        [0.00, 0.15],
    leaveProb:      0.05,
    absence:        [0.00, 0.05],
    shortTenureProb:0.05,
    risk:           [0.03, 0.18],
  },
  {
    name: 'stable_employee',
    count: 300,
    attDrop:        [0.00, 0.12],
    promoStag:      [0.15, 0.45],
    hikeStag:       [0.15, 0.45],
    declineProb:    0.10,
    lowPerf:        [0.10, 0.35],
    leaveProb:      0.10,
    absence:        [0.00, 0.12],
    shortTenureProb:0.10,
    risk:           [0.15, 0.35],
  },
  {
    name: 'medium_risk',
    count: 300,
    attDrop:        [0.10, 0.35],
    promoStag:      [0.40, 0.65],
    hikeStag:       [0.40, 0.65],
    declineProb:    0.40,
    lowPerf:        [0.25, 0.55],
    leaveProb:      0.35,
    absence:        [0.10, 0.30],
    shortTenureProb:0.20,
    risk:           [0.35, 0.62],
  },
  {
    name: 'high_risk',
    count: 200,
    attDrop:        [0.30, 0.65],
    promoStag:      [0.60, 0.90],
    hikeStag:       [0.60, 0.90],
    declineProb:    0.75,
    lowPerf:        [0.45, 0.75],
    leaveProb:      0.75,
    absence:        [0.25, 0.55],
    shortTenureProb:0.25,
    risk:           [0.62, 0.85],
  },
  {
    name: 'critical_risk',
    count: 150,
    attDrop:        [0.55, 0.95],
    promoStag:      [0.80, 1.00],
    hikeStag:       [0.80, 1.00],
    declineProb:    0.92,
    lowPerf:        [0.60, 0.95],
    leaveProb:      0.90,
    absence:        [0.45, 0.90],
    shortTenureProb:0.30,
    risk:           [0.83, 0.99],
  },
  {
    name: 'new_joiner_risk',
    // New employees can be risky even with no negative signals yet
    count: 100,
    attDrop:        [0.00, 0.10],
    promoStag:      [0.00, 0.10],
    hikeStag:       [0.00, 0.10],
    declineProb:    0.05,
    lowPerf:        [0.10, 0.35],
    leaveProb:      0.15,
    absence:        [0.00, 0.10],
    shortTenureProb:0.95,
    risk:           [0.30, 0.55],
  },
];

const generateTrainingData = () => {
  const dataset = [];
  for (const profile of PROFILES) {
    for (let i = 0; i < profile.count; i++) {
      dataset.push(generateSample(profile));
    }
  }
  // Shuffle
  for (let i = dataset.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
  }
  return dataset;
};

module.exports = generateTrainingData;

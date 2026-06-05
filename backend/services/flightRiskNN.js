const brain = require('brain.js/dist/browser.js');
const fs    = require('fs');
const path  = require('path');
const generateTrainingData = require('../utils/generateSyntheticData');

const MODEL_PATH = path.join(__dirname, '../ml_models/flight_risk_nn.json');

// ── Network config ────────────────────────────────────────────────────────────
const NET_CONFIG = {
  hiddenLayers: [16, 8],       // 8 → 16 → 8 → 1
  activation:   'sigmoid',
  learningRate: 0.05,
};

const TRAIN_CONFIG = {
  iterations:  6000,
  errorThresh: 0.004,
  logPeriod:   500,
  log: (stats) => console.log(`  [NN Training] iteration: ${stats.iterations}  error: ${stats.error.toFixed(6)}`),
};

let network = null; // singleton — loaded once per process

// ─────────────────────────────────────────────────────────────────────────────
// Train the network on synthetic data and persist to disk
// ─────────────────────────────────────────────────────────────────────────────
const trainAndSave = () => {
  console.log('\n🧠 Flight Risk NN: generating synthetic training data...');
  const data = generateTrainingData();
  console.log(`   ${data.length} samples across 6 risk profiles`);

  const net = new brain.NeuralNetwork(NET_CONFIG);

  console.log('🧠 Training neural network (8→16→8→1, sigmoid)...');
  const result = net.train(data, TRAIN_CONFIG);
  console.log(`✓  Training complete — iterations: ${result.iterations}, error: ${result.error.toFixed(6)}`);

  // Persist
  const json = net.toJSON();
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(json, null, 2));
  console.log(`✓  Model saved to ${MODEL_PATH}\n`);

  return net;
};

// ─────────────────────────────────────────────────────────────────────────────
// Load model from disk (or train fresh if not found)
// ─────────────────────────────────────────────────────────────────────────────
const loadOrTrain = () => {
  if (network) return network; // already loaded

  if (fs.existsSync(MODEL_PATH)) {
    console.log('🧠 Flight Risk NN: loading pre-trained model from disk...');
    const json = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
    const net  = new brain.NeuralNetwork(NET_CONFIG);
    net.fromJSON(json);
    network = net;
    console.log('✓  Model loaded.\n');
  } else {
    network = trainAndSave();
  }

  return network;
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalize raw DB signals into the 0-1 feature vector
// ─────────────────────────────────────────────────────────────────────────────
const normalizeSignals = (signals) => ({
  attendanceDrop:      Math.min(1, (signals.attendanceDropPercent || 0) / 100),
  promotionStagnation: Math.min(1, (signals.daysSinceLastPromotion || 0) / 730),
  hikeStagnation:      Math.min(1, (signals.daysSinceLastHike || 0) / 730),
  performanceDeclining:signals.performanceTrend === 'declining' ? 1 : 0,
  lowPerformanceScore: signals.avgPerformanceScore != null
    ? Math.min(1, 1 - (signals.avgPerformanceScore / 100))
    : 0.5,
  leaveSpike:          signals.leaveFrequencyIncreased ? 1 : 0,
  absenceRate:         Math.min(1, (signals.recentAbsenceCount || 0) / 10),
  shortTenure:         (signals.daysSinceLastPromotion || 0) < 180 ? 1 : 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// Run inference — returns riskScore (0-100) and riskLevel
// ─────────────────────────────────────────────────────────────────────────────
const predict = (signals) => {
  const net   = loadOrTrain();
  const input = normalizeSignals(signals);
  const out   = net.run(input);
  const score = Math.round((out.riskScore ?? out[0]) * 100);

  const level =
    score >= 86 ? 'critical' :
    score >= 61 ? 'high'     :
    score >= 31 ? 'medium'   : 'low';

  return { riskScore: score, riskLevel: level, normalizedInput: input };
};

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based insight — no LLM needed
// Finds the top 2 contributing signals and writes a specific recommendation
// ─────────────────────────────────────────────────────────────────────────────
const generateInsight = (signals, riskLevel, employeeName) => {
  const reasons = [];

  if (signals.attendanceDropPercent > 20)
    reasons.push({ weight: signals.attendanceDropPercent, text: `${signals.attendanceDropPercent}% attendance drop vs previous period` });
  if (signals.daysSinceLastPromotion > 540)
    reasons.push({ weight: signals.daysSinceLastPromotion / 10, text: `no promotion in ${Math.round(signals.daysSinceLastPromotion/30)} months` });
  if (signals.daysSinceLastHike > 365)
    reasons.push({ weight: signals.daysSinceLastHike / 10, text: `no salary hike in ${Math.round(signals.daysSinceLastHike/30)} months` });
  if (signals.performanceTrend === 'declining')
    reasons.push({ weight: 60, text: 'declining performance trend across recent reviews' });
  if (signals.leaveFrequencyIncreased)
    reasons.push({ weight: 50, text: 'sudden spike in leave applications' });
  if (signals.recentAbsenceCount > 3)
    reasons.push({ weight: signals.recentAbsenceCount * 8, text: `${signals.recentAbsenceCount} unplanned absences in the last 30 days` });
  if (signals.avgPerformanceScore != null && signals.avgPerformanceScore < 50)
    reasons.push({ weight: 70, text: `low average performance score of ${signals.avgPerformanceScore}/100` });

  reasons.sort((a, b) => b.weight - a.weight);
  const top = reasons.slice(0, 2).map(r => r.text);

  const actionMap = {
    critical: `Schedule an immediate 1-on-1 with ${employeeName}. Key concerns: ${top.join('; ')}. Consider a retention package or role adjustment before it's too late.`,
    high:     `Proactively engage ${employeeName} this week. Signals indicate: ${top.join('; ')}. A career development conversation or compensation review is strongly recommended.`,
    medium:   `Monitor ${employeeName} closely over the next 30 days. Risk factors: ${top.length ? top.join('; ') : 'mild engagement signals'}. A check-in meeting is advised.`,
    low:      `${employeeName} appears stable. Continue regular performance check-ins to maintain engagement.`,
  };

  return actionMap[riskLevel] || actionMap.medium;
};

// ─────────────────────────────────────────────────────────────────────────────
// Retrain on demand (admin action)
// ─────────────────────────────────────────────────────────────────────────────
const retrain = () => {
  network = trainAndSave();
  return { message: 'Model retrained successfully.' };
};

// Pre-load the model when this module is first imported
setTimeout(loadOrTrain, 100);

module.exports = { predict, generateInsight, retrain, normalizeSignals };

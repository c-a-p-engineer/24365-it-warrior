const $ = (id) => document.getElementById(id);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

const START_LIVES = 3;
const LEVELS = [
  { label: 'ERROR', icon: '🔴', keys: ['ERROR'], quota: 3 },
  { label: 'WARN', icon: '🟡', keys: ['WARN'], quota: 4 },
  { label: 'ERROR + payment', icon: '💳', keys: ['ERROR', 'payment'], quota: 4 },
  { label: '500', icon: '💥', keys: ['500'], quota: 5 },
  { label: 'timeout', icon: '⏱️', keys: ['timeout'], quota: 5 },
  { label: 'ERROR + auth', icon: '🔐', keys: ['ERROR', 'auth'], quota: 6 },
  { label: 'REQ=A82F', icon: '🧬', keys: ['A82F'], quota: 6 },
  { label: 'payrnent', icon: '👁️', keys: ['payrnent'], quota: 7 }
];
const SERVICES = ['auth', 'payment', 'cache', 'profile', 'order', 'search', 'mail', 'upload'];
const ACTIONS = ['success', 'failed', 'timeout', 'retry', 'ready', 'denied', 'slow', 'complete'];
const IDS = ['A82F', 'C91B', 'F10D', 'D44A', 'B77E', 'E09C'];

let state = null;
let spawnTimer = null;

function makeState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: START_LIVES,
    level: 0,
    foundInLevel: 0,
    found: 0,
    taps: 0,
    correct: 0,
    running: true,
    paused: false,
    tutorial: true,
    rowId: 0,
    elapsedSpawns: 0,
    speedFactor: 1
  };
}

function startGame() {
  clearTimeout(spawnTimer);
  state = makeState();
  hide('title-screen');
  hide('result-screen');
  show('game-screen');
  $('log-lane').innerHTML = '';
  document.body.classList.remove('human-grep', 'time-critical', 'paused');
  renderAll();
  setTarget(true);
  scheduleSpawn(250);
  burst('SYSTEM MONITOR START', 'info');
  react('focus', '異常ログを探せ', '光った行をタップ');
}

function currentLevel() {
  return LEVELS[Math.min(state.level, LEVELS.length - 1)];
}

function speedFactor() {
  const progressBoost = state.elapsedSpawns * 0.012;
  const levelBoost = state.level * 0.12;
  return Math.min(3.2, 1 + progressBoost + levelBoost);
}

function travelTime() {
  return Math.max(1650, 6600 / speedFactor());
}

function spawnInterval() {
  return Math.max(300, 1450 / speedFactor());
}

function scheduleSpawn(delay) {
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    if (!state?.running) return;
    if (!state.paused) {
      spawnLog();
      state.elapsedSpawns += 1;
      state.speedFactor = speedFactor();
      renderAll();
      announceSpeedMilestone();
    }
    scheduleSpawn(spawnInterval() + Math.random() * 180);
  }, delay);
}

function announceSpeedMilestone() {
  const step = Math.floor(state.speedFactor * 10);
  if ([13, 16, 20, 25, 30].includes(step) && state.lastSpeedNotice !== step) {
    state.lastSpeedNotice = step;
    burst(`SPEED ${state.speedFactor.toFixed(1)}x`, 'combo');
    restart($('game-screen'), 'combo-aura');
  }
}

function setTarget(initial = false) {
  const target = currentLevel();
  $('target-value').textContent = target.label;
  $('target-count').textContent = `${state.foundInLevel} / ${target.quota}`;
  document.querySelector('.target-icon').textContent = target.icon;
  restart($('target-panel'), initial ? 'target-enter' : 'target-swap');
  if (!initial) {
    burst('NEW TARGET', 'info');
    react('focus', target.label, '同じ特徴を探せ');
  }
}

function makeLog(forceMatch = false) {
  const target = currentLevel();
  const shouldMatch = forceMatch || Math.random() < 0.25;
  let type = pick(['INFO', 'INFO', 'WARN', 'ERROR']);
  let service = pick(SERVICES);
  let action = pick(ACTIONS);
  let status = pick(['200', '200', '201', '404', '500', '503']);
  let id = pick(IDS);

  if (shouldMatch) {
    target.keys.forEach((key) => {
      if (key === 'ERROR' || key === 'WARN') type = key;
      else if (key === 'payment') service = 'payment';
      else if (key === 'auth') service = 'auth';
      else if (key === 'timeout') action = 'timeout';
      else if (key === '500') status = '500';
      else if (key === 'A82F') id = 'A82F';
      else if (key === 'payrnent') service = 'payrnent';
    });
  } else {
    let text = `${type} ${service} ${action} ${status} ${id}`;
    if (target.keys.every((key) => text.includes(key))) {
      type = type === 'ERROR' ? 'INFO' : type;
      service = service === 'payment' || service === 'payrnent' ? 'order' : service;
      action = action === 'timeout' ? 'complete' : action;
      status = status === '500' ? '200' : status;
      id = id === 'A82F' ? 'C91B' : id;
    }
  }

  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  const text = `${time} ${type.padEnd(5)} ${service} ${action} ${status} REQ=${id}`;
  return { id: ++state.rowId, text, match: target.keys.every((key) => text.includes(key)), type };
}

function spawnLog() {
  const tutorialMatch = state.tutorial && state.rowId === 1;
  const log = makeLog(tutorialMatch);
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `log-row type-${log.type.toLowerCase()}${tutorialMatch ? ' tutorial-target' : ''}`;
  row.dataset.match = String(log.match);
  row.dataset.id = String(log.id);
  row.style.setProperty('--travel-time', `${travelTime()}ms`);
  row.innerHTML = tokenize(log.text);
  row.addEventListener('click', () => selectRow(row));
  row.addEventListener('animationend', (event) => {
    if (event.animationName !== 'log-travel') return;
    if (row.dataset.match === 'true' && row.dataset.handled !== 'true') missRow(row);
    row.remove();
  });
  $('log-lane').append(row);

  if (tutorialMatch) {
    $('tutorial-hand').classList.remove('hidden');
    requestAnimationFrame(() => positionHand(row));
  }
}

function tokenize(text) {
  return text.split(' ').map((token) => {
    let cls = '';
    if (token === 'ERROR') cls = 'token-error';
    else if (token === 'WARN') cls = 'token-warn';
    else if (token === '500' || token === '503') cls = 'token-status';
    else if (token.includes('timeout')) cls = 'token-timeout';
    return `<span class="${cls}">${token}</span>`;
  }).join(' ');
}

function positionHand(row) {
  const rowRect = row.getBoundingClientRect();
  const wrapRect = document.querySelector('.terminal-wrap').getBoundingClientRect();
  $('tutorial-hand').style.top = `${rowRect.top - wrapRect.top + rowRect.height / 2}px`;
}

function selectRow(row) {
  if (!state?.running || state.paused || row.dataset.handled === 'true') return;
  row.dataset.handled = 'true';
  state.taps += 1;
  row.dataset.match === 'true' ? correctRow(row) : wrongRow(row);
}

function correctRow(row) {
  state.correct += 1;
  state.found += 1;
  state.foundInLevel += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const gain = Math.round((100 + state.combo * 20 + state.level * 35) * state.speedFactor);
  state.score += gain;
  row.classList.add('matched');
  createFragments(row, 'good');
  popAt(row, `MATCH +${gain}`, 'good');
  restart($('combo-value'), 'metric-pop');
  restart($('operator-face'), state.combo >= 10 ? 'operator-awaken' : 'operator-win');
  if (state.combo === 5 || state.combo === 10 || state.combo % 20 === 0) comboBurst();
  if (state.tutorial) {
    state.tutorial = false;
    $('tutorial-hand').classList.add('hidden');
    burst('GOOD!', 'good');
  }
  react('win', `${state.combo} COMBO`, '次の異常を探せ');
  row.addEventListener('animationend', () => row.remove(), { once: true });
  advanceTarget();
  renderAll();
}

function loseLife(message, row) {
  state.combo = 0;
  state.lives -= 1;
  if (row) createFragments(row, 'fire');
  burst(`${message}  -1 LIFE`, 'danger');
  restart($('game-screen'), 'screen-hit');
  restart($('time-value'), 'metric-denied');
  restart($('operator-face'), 'operator-panic');
  react('panic', message, state.lives > 0 ? `残りライフ ${state.lives}` : '監視継続不能');
  renderAll();
  if (state.lives <= 0) endGame('ライフが尽きた');
}

function wrongRow(row) {
  row.classList.add('wrong');
  popAt(row, 'FALSE POSITIVE', 'danger');
  noiseFlash();
  loseLife('誤検知', row);
}

function missRow(row) {
  if (!state?.running || row.dataset.handled === 'true') return;
  row.dataset.handled = 'true';
  loseLife('見落とし', row);
}

function advanceTarget() {
  const target = currentLevel();
  if (state.foundInLevel < target.quota) return;
  state.foundInLevel = 0;
  if (state.level < LEVELS.length - 1) state.level += 1;
  setTarget();
  document.body.classList.toggle('human-grep', state.level >= 5);
}

function comboBurst() {
  const text = state.combo >= 20 ? 'HUMAN GREP MODE' : `${state.combo} COMBO`;
  burst(text, 'combo');
  createParticles(22);
  restart($('game-screen'), 'combo-aura');
}

function renderAll() {
  if (!state) return;
  $('score-value').textContent = state.score.toLocaleString('ja-JP');
  $('combo-value').textContent = state.combo;
  $('time-value').textContent = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, START_LIVES - state.lives));
  $('fire-value').textContent = `${state.speedFactor.toFixed(1)}x`;
  $('fire-bar').style.width = `${Math.min(100, (state.speedFactor - 1) / 2.2 * 100)}%`;
  $('fire-bar').classList.toggle('danger', state.speedFactor >= 2.3);
  $('target-count').textContent = `${state.foundInLevel} / ${currentLevel().quota}`;
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 100;
  $('accuracy-value').textContent = `${accuracy}%`;
}

function endGame(reason) {
  if (!state?.running) return;
  state.running = false;
  clearTimeout(spawnTimer);
  document.body.classList.remove('human-grep', 'paused');
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 0;
  const record = { score: state.score, combo: state.maxCombo, found: state.found, accuracy, speed: state.speedFactor };
  const best = JSON.parse(localStorage.getItem('meGrepBest') || 'null');
  if (!best || record.score > best.score) localStorage.setItem('meGrepBest', JSON.stringify(record));
  burst('MONITOR END', 'danger');
  restart($('game-screen'), 'shutdown');
  setTimeout(() => {
    hide('game-screen');
    show('result-screen');
    $('result-score').textContent = record.score.toLocaleString('ja-JP');
    $('result-combo').textContent = record.combo;
    $('result-found').textContent = record.found;
    $('result-accuracy').textContent = `${record.accuracy}%`;
    $('result-comment').textContent = `最高速度 ${record.speed.toFixed(1)}x。${record.accuracy >= 95 ? '総評：grepを使えばもっと早かった。' : record.accuracy >= 75 ? '総評：人力としては許容範囲。' : '総評：検索コマンドの導入を推奨。'}`;
    $('result-title').textContent = reason;
    restart($('result-screen'), 'result-drop');
  }, 650);
}

function pauseGame() {
  if (!state?.running) return;
  state.paused = true;
  document.body.classList.add('paused');
  $('pause-dialog').showModal();
}
function resumeGame() {
  state.paused = false;
  document.body.classList.remove('paused');
  $('pause-dialog').close();
}
function react(_mode, main, sub) {
  $('operator-message').textContent = main;
  $('sub-message').textContent = sub;
}
function restart(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}
function burst(text, tone = 'info') {
  const node = document.createElement('div');
  node.className = `burst ${tone}`;
  node.textContent = text;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}
function popAt(row, text, tone) {
  const rect = row.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = `pop-text ${tone}`;
  node.textContent = text;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height / 2}px`;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}
function createFragments(row, tone) {
  const rect = row.getBoundingClientRect();
  for (let index = 0; index < 8; index += 1) {
    const node = document.createElement('i');
    node.className = `fragment ${tone}`;
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top + rect.height / 2}px`;
    node.style.setProperty('--x', `${(Math.random() - 0.5) * 150}px`);
    node.style.setProperty('--y', `${(Math.random() - 0.5) * 90}px`);
    $('fx-layer').append(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
}
function createParticles(count) {
  for (let index = 0; index < count; index += 1) {
    const node = document.createElement('i');
    node.className = 'combo-particle';
    node.style.left = `${20 + Math.random() * 60}%`;
    node.style.top = `${20 + Math.random() * 60}%`;
    $('fx-layer').append(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
}
function noiseFlash() { restart($('game-screen'), 'noise-flash'); }
function renderBest() {
  const best = JSON.parse(localStorage.getItem('meGrepBest') || 'null');
  $('best-record').innerHTML = best
    ? `<span>最高記録</span><strong>${best.score.toLocaleString('ja-JP')}点</strong><small>${best.combo} COMBO ／ ${best.found}件発見</small>`
    : '<span>最高記録</span><strong>未記録</strong><small>監視を開始しよう</small>';
}
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

$('start-button').addEventListener('click', startGame);
$('retry-button').addEventListener('click', startGame);
$('back-button').addEventListener('click', () => { hide('result-screen'); show('title-screen'); renderBest(); });
$('pause-button').addEventListener('click', pauseGame);
$('resume-button').addEventListener('click', resumeGame);
$('quit-button').addEventListener('click', () => { $('pause-dialog').close(); endGame('自主的に監視を終了した'); });

renderBest();
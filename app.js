const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (items) => items[Math.floor(Math.random() * items.length)];

const LEVELS = [
  { label: 'ERROR', icon: '🔴', keys: ['ERROR'], quota: 3, speed: 6200 },
  { label: 'WARN', icon: '🟡', keys: ['WARN'], quota: 4, speed: 5700 },
  { label: 'ERROR + payment', icon: '💳', keys: ['ERROR', 'payment'], quota: 4, speed: 5200 },
  { label: '500', icon: '💥', keys: ['500'], quota: 5, speed: 4700 },
  { label: 'timeout', icon: '⏱️', keys: ['timeout'], quota: 5, speed: 4300 },
  { label: 'ERROR + auth', icon: '🔐', keys: ['ERROR', 'auth'], quota: 6, speed: 3900 },
  { label: 'REQ=A82F', icon: '🧬', keys: ['A82F'], quota: 6, speed: 3500 },
  { label: 'payrnent', icon: '👁️', keys: ['payrnent'], quota: 7, speed: 3200 }
];

const SERVICES = ['auth', 'payment', 'cache', 'profile', 'order', 'search', 'mail', 'upload'];
const ACTIONS = ['success', 'failed', 'timeout', 'retry', 'ready', 'denied', 'slow', 'complete'];
const IDS = ['A82F', 'C91B', 'F10D', 'D44A', 'B77E', 'E09C'];

let state = null;
let spawnTimer = null;
let clockTimer = null;

function makeState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    fire: 0,
    time: 60,
    level: 0,
    foundInLevel: 0,
    found: 0,
    taps: 0,
    correct: 0,
    running: true,
    paused: false,
    tutorial: true,
    rowId: 0
  };
}

function startGame() {
  clearTimers();
  state = makeState();
  hide('title-screen');
  hide('result-screen');
  show('game-screen');
  $('log-lane').innerHTML = '';
  renderAll();
  setTarget(true);
  startLoops();
  burst('SYSTEM MONITOR START', 'info');
  react('focus', '異常ログを探せ', '光った行をタップ');
}

function startLoops() {
  scheduleSpawn(260);
  clockTimer = setInterval(() => {
    if (!state?.running || state.paused) return;
    state.time -= 1;
    $('time-value').textContent = state.time;
    if (state.time <= 10) document.body.classList.add('time-critical');
    if (state.time <= 0) endGame('勤務時間終了');
  }, 1000);
}

function scheduleSpawn(delay) {
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    if (!state?.running) return;
    if (!state.paused) spawnLog();
    const level = LEVELS[state.level];
    const density = Math.max(360, level.speed / 4.6);
    scheduleSpawn(density + Math.random() * 280);
  }, delay);
}

function currentLevel() {
  return LEVELS[Math.min(state.level, LEVELS.length - 1)];
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
  const shouldMatch = forceMatch || Math.random() < 0.26;
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
    const text = `${type} ${service} ${action} ${status} ${id}`;
    if (target.keys.every((key) => text.includes(key))) {
      service = service === 'payment' ? 'order' : service;
      type = type === 'ERROR' ? 'INFO' : type;
      status = status === '500' ? '200' : status;
      id = id === 'A82F' ? 'C91B' : id;
      action = action === 'timeout' ? 'complete' : action;
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
  row.style.setProperty('--travel-time', `${currentLevel().speed}ms`);
  row.innerHTML = tokenize(log.text);
  row.addEventListener('click', () => selectRow(row));
  row.addEventListener('animationend', (event) => {
    if (event.animationName !== 'log-travel') return;
    if (row.dataset.match === 'true' && row.dataset.handled !== 'true') missRow(row);
    row.remove();
  });
  $('log-lane').append(row);

  if (tutorialMatch) {
    const hand = $('tutorial-hand');
    hand.classList.remove('hidden');
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
  if (row.dataset.match === 'true') correctRow(row);
  else wrongRow(row);
}

function correctRow(row) {
  state.correct += 1;
  state.found += 1;
  state.foundInLevel += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const gain = 100 + state.combo * 20 + state.level * 35;
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

function wrongRow(row) {
  state.combo = 0;
  state.fire = Math.min(100, state.fire + 12);
  row.classList.add('wrong');
  popAt(row, 'FALSE POSITIVE', 'danger');
  noiseFlash();
  restart($('operator-face'), 'operator-miss');
  react('miss', '誤検知', '検索条件を確認');
  renderAll();
  checkFailure();
}

function missRow(row) {
  if (!state?.running) return;
  state.combo = 0;
  state.fire = Math.min(100, state.fire + 18);
  createFragments(row, 'fire');
  burst('MISSED!', 'danger');
  restart($('game-screen'), 'screen-hit');
  restart($('operator-face'), 'operator-panic');
  react('panic', '見落とした！', '炎上度が上昇');
  renderAll();
  checkFailure();
}

function advanceTarget() {
  const target = currentLevel();
  if (state.foundInLevel < target.quota) return;
  state.foundInLevel = 0;
  if (state.level < LEVELS.length - 1) state.level += 1;
  else state.time += 8;
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
  $('time-value').textContent = state.time;
  $('fire-value').textContent = state.fire;
  $('fire-bar').style.width = `${state.fire}%`;
  $('fire-bar').classList.toggle('danger', state.fire >= 60);
  $('target-count').textContent = `${state.foundInLevel} / ${currentLevel().quota}`;
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 100;
  $('accuracy-value').textContent = `${accuracy}%`;
}

function checkFailure() {
  if (state.fire >= 100) endGame('炎上が臨界点に達した');
}

function endGame(reason) {
  if (!state?.running) return;
  state.running = false;
  clearTimers();
  document.body.classList.remove('time-critical', 'human-grep');
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 0;
  const record = { score: state.score, combo: state.maxCombo, found: state.found, accuracy };
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
    $('result-comment').textContent = record.accuracy >= 95 ? '総評：grepを使えばもっと早かった。' : record.accuracy >= 75 ? '総評：人力としては許容範囲。' : '総評：検索コマンドの導入を推奨。';
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

function clearTimers() {
  clearTimeout(spawnTimer);
  clearInterval(clockTimer);
}

function react(mode, main, sub) {
  $('operator-message').textContent = main;
  $('sub-message').textContent = sub;
  const faces = { focus: '🧑‍💻', win: '😎', miss: '😖', panic: '😱' };
  $('operator-face').textContent = faces[mode] || '🧑‍💻';
}

function restart(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  node.addEventListener('animationend', () => node.classList.remove(cls), { once: true });
}

function popAt(node, text, tone) {
  const rect = node.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = `point-pop ${tone}`;
  fx.textContent = text;
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;
  $('fx-layer').append(fx);
  fx.addEventListener('animationend', () => fx.remove(), { once: true });
}

function burst(text, tone) {
  const fx = document.createElement('div');
  fx.className = `center-burst ${tone}`;
  fx.textContent = text;
  $('fx-layer').append(fx);
  fx.addEventListener('animationend', () => fx.remove(), { once: true });
}

function createFragments(row, tone) {
  const rect = row.getBoundingClientRect();
  for (let i = 0; i < 8; i += 1) {
    const piece = document.createElement('i');
    piece.className = `fragment ${tone}`;
    piece.style.left = `${rect.left + rect.width / 2}px`;
    piece.style.top = `${rect.top + rect.height / 2}px`;
    piece.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--y', `${(Math.random() - 0.5) * 100}px`);
    $('fx-layer').append(piece);
    piece.addEventListener('animationend', () => piece.remove(), { once: true });
  }
}

function createParticles(count) {
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement('i');
    particle.className = 'combo-particle';
    particle.style.left = `${20 + Math.random() * 60}%`;
    particle.style.top = `${20 + Math.random() * 60}%`;
    particle.style.setProperty('--x', `${(Math.random() - 0.5) * 220}px`);
    particle.style.setProperty('--y', `${-40 - Math.random() * 160}px`);
    $('fx-layer').append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

function noiseFlash() {
  const fx = document.createElement('div');
  fx.className = 'noise-flash';
  $('fx-layer').append(fx);
  fx.addEventListener('animationend', () => fx.remove(), { once: true });
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function renderBest() {
  const best = JSON.parse(localStorage.getItem('meGrepBest') || 'null');
  $('best-record').innerHTML = best
    ? `<span>最高記録</span><strong>${best.score.toLocaleString('ja-JP')}点</strong><small>${best.combo} COMBO ／ 正解率 ${best.accuracy}%</small>`
    : '<span>最高記録</span><strong>未記録</strong><small>タップだけで開始</small>';
}

$('start-button').addEventListener('click', startGame);
$('retry-button').addEventListener('click', startGame);
$('back-button').addEventListener('click', () => { hide('result-screen'); show('title-screen'); renderBest(); });
$('pause-button').addEventListener('click', pauseGame);
$('resume-button').addEventListener('click', resumeGame);
$('quit-button').addEventListener('click', () => { $('pause-dialog').close(); endGame('自主的に監視を終了した'); });

renderBest();
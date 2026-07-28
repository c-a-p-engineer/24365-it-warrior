const BOARD_SIZE = 4;
const MOVES_PER_DAY = 10;

const COMPANIES = [
  { id: 'enterprise', name: '大企業', icon: '🏢', desc: '安定度が高く、パッチも多い', stability: 120, patches: 3, spawnChance2: 0.08, scoreRate: 1 },
  { id: 'ses', name: 'SES', icon: '🔀', desc: '得点は高いが大きなバグが出やすい', stability: 100, patches: 2, spawnChance2: 0.25, scoreRate: 1.25 },
  { id: 'contract', name: '受託開発', icon: '🤝', desc: '短期決戦。安定度は低いがパッチ効率が高い', stability: 85, patches: 4, spawnChance2: 0.18, scoreRate: 1.15 },
  { id: 'service', name: '自社サービス', icon: '🚀', desc: '連続マージで得点が伸びる', stability: 100, patches: 2, spawnChance2: 0.12, scoreRate: 1.05, comboBonus: true }
];

const LEVELS = {
  1: { name: '警告', icon: '⚠️', className: 'level-1', patchCost: 1, score: 10 },
  2: { name: '軽微', icon: '🐛', className: 'level-2', patchCost: 1, score: 35 },
  3: { name: '重大', icon: '💥', className: 'level-3', patchCost: 2, score: 100 },
  4: { name: '緊急', icon: '🔥', className: 'level-4', patchCost: 3, score: 280 },
  5: { name: '本番障害', icon: '☠️', className: 'level-5', patchCost: 5, score: 800 }
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

let game = null;
let selectedCompanyId = COMPANIES[0].id;
let touchStart = null;
let animationLocked = false;

function selectedCompany() {
  return COMPANIES.find((company) => company.id === selectedCompanyId) || COMPANIES[0];
}

function renderCompanyOptions() {
  $('company-options').innerHTML = COMPANIES.map((company) => `
    <button class="company-card ${company.id === selectedCompanyId ? 'selected' : ''}" data-company="${company.id}" type="button">
      <span class="company-icon">${company.icon}</span>
      <strong>${company.name}</strong>
      <small>${company.desc}</small>
    </button>
  `).join('');

  document.querySelectorAll('[data-company]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedCompanyId = button.dataset.company;
      renderCompanyOptions();
      restartAnimation(button, 'company-picked');
    });
  });
}

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

async function startGame() {
  const company = selectedCompany();
  game = {
    company,
    board: emptyBoard(),
    score: 0,
    stability: company.stability,
    maxStability: company.stability,
    patches: company.patches,
    moves: 0,
    day: 1,
    maxLevel: 1,
    patchMode: false,
    combo: 0,
    lastSpawn: null,
    gameOver: false
  };

  spawnBug();
  spawnBug();
  hide('title-screen');
  hide('result-screen');
  show('game-screen');
  renderGame();
  setStatus(`${company.name}へ入社。バグを本番障害になる前に処理しよう。`);
  showDayTransition(1, false);
  restartAnimation($('game-screen'), 'game-start-burst');
  await wait(450);
}

function availableCells() {
  const cells = [];
  game.board.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
    if (value === 0) cells.push([rowIndex, colIndex]);
  }));
  return cells;
}

function spawnBug() {
  const cells = availableCells();
  if (!cells.length) return false;
  const [row, col] = randomItem(cells);
  const level = Math.random() < game.company.spawnChance2 ? 2 : 1;
  game.board[row][col] = level;
  game.lastSpawn = `${row}-${col}`;
  return true;
}

function slideAndMerge(line) {
  const compact = line.filter(Boolean);
  const result = [];
  let merges = 0;
  let gained = 0;
  let maxCreated = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const nextLevel = Math.min(5, compact[index] + 1);
      result.push(nextLevel);
      merges += 1;
      maxCreated = Math.max(maxCreated, nextLevel);
      gained += LEVELS[nextLevel].score;
      index += 1;
    } else {
      result.push(compact[index]);
    }
  }

  while (result.length < BOARD_SIZE) result.push(0);
  return { line: result, merges, gained, maxCreated };
}

function transpose(board) {
  return board[0].map((_, colIndex) => board.map((row) => row[colIndex]));
}

function reverseRows(board) {
  return board.map((row) => [...row].reverse());
}

function boardsEqual(a, b) {
  return a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));
}

function calculateMove(direction) {
  let working = game.board.map((row) => [...row]);
  let reverseAfter = false;
  let transposeAfter = false;

  if (direction === 'right') {
    working = reverseRows(working);
    reverseAfter = true;
  } else if (direction === 'up') {
    working = transpose(working);
    transposeAfter = true;
  } else if (direction === 'down') {
    working = reverseRows(transpose(working));
    reverseAfter = true;
    transposeAfter = true;
  }

  let merges = 0;
  let gained = 0;
  let maxCreated = 0;
  working = working.map((line) => {
    const merged = slideAndMerge(line);
    merges += merged.merges;
    gained += merged.gained;
    maxCreated = Math.max(maxCreated, merged.maxCreated);
    return merged.line;
  });

  if (reverseAfter) working = reverseRows(working);
  if (transposeAfter) working = transpose(working);
  return { board: working, merges, gained, maxCreated };
}

async function move(direction) {
  if (!game || game.gameOver || animationLocked || game.patchMode) return;
  const result = calculateMove(direction);
  if (boardsEqual(game.board, result.board)) {
    animateInvalidMove(direction);
    return;
  }

  animationLocked = true;
  animateBoardDirection(direction);
  await wait(90);

  const previousStability = game.stability;
  const previousScore = game.score;
  game.board = result.board;
  game.moves += 1;
  game.combo = result.merges ? game.combo + result.merges : 0;
  game.patches += result.merges;

  const comboMultiplier = game.company.comboBonus && game.combo >= 2 ? 1 + Math.min(game.combo, 6) * 0.1 : 1;
  game.score += Math.round(result.gained * game.company.scoreRate * comboMultiplier);
  game.maxLevel = Math.max(game.maxLevel, result.maxCreated || 1);

  drainStability();
  spawnBug();
  const dayChanged = updateDay();
  renderGame();

  animateMetric('score-value', game.score - previousScore, 'score-pop');
  if (game.stability < previousStability) animateStabilityDamage(previousStability - game.stability);

  if (result.merges) {
    animateMerge(result.merges, result.maxCreated);
    showFloat(`MERGE ×${result.merges}`, 'good');
    showScoreBurst(result.gained);
    if (game.combo >= 2) animateCombo(game.combo);
  } else {
    restartAnimation($('board'), 'board-settle');
  }

  if (result.maxCreated >= 4) {
    criticalFlash(result.maxCreated);
  }
  if (result.maxCreated === 5) {
    showBanner('🚨 本番障害 発生 🚨', 'critical');
    setStatus('本番障害が発生。安定度の低下が加速する。');
    restartAnimation($('engineer-face'), 'engineer-panic');
  }
  if (dayChanged) await wait(260);

  await wait(330);
  animationLocked = false;
  checkGameOver();
}

function drainStability() {
  let drain = 0;
  game.board.flat().forEach((level) => {
    if (level === 4) drain += 1;
    if (level === 5) drain += 7;
  });
  if (game.day % 5 === 0) drain += 2;
  game.stability = Math.max(0, game.stability - drain);
}

function updateDay() {
  const nextDay = Math.floor(game.moves / MOVES_PER_DAY) + 1;
  if (nextDay <= game.day) return false;
  game.day = nextDay;
  game.patches += 1;
  game.stability = Math.min(game.maxStability, game.stability + 4);
  const friday = game.day % 5 === 0;
  showDayTransition(game.day, friday);
  setStatus(friday ? '金曜日。障害負荷が上昇している。' : '翌日へ。パッチを1つ補充した。');
  return true;
}

function togglePatchMode() {
  if (!game || game.gameOver) return;
  game.patchMode = !game.patchMode;
  $('patch-mode-button').classList.toggle('active', game.patchMode);
  $('board').classList.toggle('patch-mode', game.patchMode);
  restartAnimation($('patch-mode-button'), game.patchMode ? 'patch-charge' : 'button-release');
  if (game.patchMode) {
    showBanner('PATCH MODE', 'patch');
    createScanLines();
  }
  setStatus(game.patchMode ? '除去するバグをタップ。大きいバグほど多くのパッチが必要。' : '盤面をスワイプしてバグをマージ。');
}

async function patchTile(row, col) {
  if (!game.patchMode || game.gameOver || animationLocked) return;
  const level = game.board[row][col];
  if (!level) return;
  const cost = LEVELS[level].patchCost;
  if (game.patches < cost) {
    showFloat(`パッチ不足 -${cost}`, 'danger');
    bumpTile(row, col);
    restartAnimation($('patch-value'), 'metric-denied');
    return;
  }

  animationLocked = true;
  const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  await animatePatchBeam(tile, LEVELS[level].icon);
  game.patches -= cost;
  game.board[row][col] = 0;
  const reward = Math.round(LEVELS[level].score * 1.4 * game.company.scoreRate);
  game.score += reward;
  game.stability = Math.min(game.maxStability, game.stability + level * 2);
  game.patchMode = false;
  game.combo = 0;
  renderGame();
  showFloat(`FIX +${reward}`, 'good');
  showParticles('good', 16);
  restartAnimation($('stability-bar'), 'stability-heal');
  restartAnimation($('engineer-face'), 'engineer-win');
  setStatus(`${LEVELS[level].name}バグを修正。本番安定度が回復した。`);
  await wait(300);
  animationLocked = false;
}

function canMove() {
  if (availableCells().length) return true;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = game.board[row][col];
      if (game.board[row + 1]?.[col] === value || game.board[row][col + 1] === value) return true;
    }
  }
  return false;
}

function checkGameOver() {
  if (game.stability <= 0) return endGame('本番安定度が0になり、サービスが停止した');
  if (!canMove()) return endGame('盤面がバグで埋まり、修正不能になった');
}

async function endGame(reason) {
  if (!game || game.gameOver) return;
  game.gameOver = true;
  animationLocked = true;
  restartAnimation($('game-screen'), 'gameover-glitch');
  showBanner('SYSTEM DOWN', 'critical');
  showParticles('danger', 26);
  await wait(850);

  const record = {
    days: game.day,
    score: game.score,
    maxLevel: game.maxLevel,
    company: game.company.name,
    reason
  };
  const best = JSON.parse(localStorage.getItem('bugMergeBest') || 'null');
  if (!best || record.score > best.score) localStorage.setItem('bugMergeBest', JSON.stringify(record));

  $('result-days').textContent = `${record.days}日`;
  $('result-score').textContent = record.score.toLocaleString('ja-JP');
  $('result-max').textContent = `${LEVELS[record.maxLevel].icon} ${LEVELS[record.maxLevel].name}`;
  $('result-company').textContent = record.company;
  $('result-reason').textContent = `退職理由：${reason}`;
  $('result-title').textContent = reason.includes('自主') ? '自主退職しました' : '本番環境が停止しました';
  hide('game-screen');
  show('result-screen');
  restartAnimation($('result-screen'), 'result-drop');
  animationLocked = false;
}

function renderGame() {
  $('day-value').textContent = `${game.day}日`;
  $('score-value').textContent = game.score.toLocaleString('ja-JP');
  $('patch-value').textContent = game.patches;
  $('company-value').textContent = `${game.company.icon} ${game.company.name}`;
  $('stability-value').textContent = game.stability;
  $('stability-bar').style.width = `${Math.max(0, game.stability / game.maxStability * 100)}%`;
  $('stability-bar').classList.toggle('danger', game.stability <= game.maxStability * 0.3);
  $('engineer-face').textContent = game.stability <= 25 ? '😵‍💫' : game.board.flat().includes(5) ? '😱' : '🧑‍💻';
  $('patch-mode-button').classList.toggle('active', game.patchMode);
  $('board').classList.toggle('patch-mode', game.patchMode);
  $('game-screen').classList.toggle('friday-mode', game.day % 5 === 0);

  $('board').innerHTML = game.board.map((row, rowIndex) => row.map((level, colIndex) => {
    const meta = level ? LEVELS[level] : null;
    const spawned = game.lastSpawn === `${rowIndex}-${colIndex}` ? 'spawned' : '';
    return `<button class="bug-cell ${meta?.className || 'empty'} ${spawned}" data-row="${rowIndex}" data-col="${colIndex}" type="button" aria-label="${meta ? `${meta.name}バグ` : '空き'}">
      ${meta ? `<span class="bug-icon">${meta.icon}</span><strong>${meta.name}</strong><small>修正 ${meta.patchCost}</small><i class="tile-shine"></i>` : ''}
    </button>`;
  }).join('')).join('');
  game.lastSpawn = null;

  document.querySelectorAll('.bug-cell').forEach((cell) => {
    cell.addEventListener('click', () => patchTile(Number(cell.dataset.row), Number(cell.dataset.col)));
  });
}

function renderBest() {
  const best = JSON.parse(localStorage.getItem('bugMergeBest') || 'null');
  $('best-record').innerHTML = best
    ? `<span>最高記録</span><strong>${best.score.toLocaleString('ja-JP')}点</strong><small>${best.days}連勤 ／ ${best.company}</small>`
    : '<span>最高記録</span><strong>未記録</strong><small>最初の出勤を始めよう</small>';
}

function setStatus(message) {
  $('status-message').textContent = message;
  restartAnimation($('status-message'), 'status-type');
}

function restartAnimation(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}

function animateBoardDirection(direction) {
  const board = $('board');
  ['move-left', 'move-right', 'move-up', 'move-down'].forEach((name) => board.classList.remove(name));
  restartAnimation(board, `move-${direction}`);
  document.querySelectorAll('.bug-cell:not(.empty)').forEach((cell, index) => {
    cell.style.setProperty('--delay', `${index * 12}ms`);
    restartAnimation(cell, 'tile-slide');
  });
}

function animateInvalidMove(direction) {
  restartAnimation($('board'), `invalid-${direction}`);
  restartAnimation($('engineer-face'), 'engineer-confused');
  showFloat('動かせない！', 'danger');
}

function animateMerge(count, maxLevel) {
  restartAnimation($('board'), 'merge-impact');
  document.querySelectorAll('.bug-cell:not(.empty)').forEach((cell) => restartAnimation(cell, 'merge-pop'));
  showParticles(maxLevel >= 4 ? 'danger' : 'good', Math.min(10 + count * 6, 28));
  restartAnimation($('patch-value'), 'metric-pop');
}

function animateCombo(combo) {
  showBanner(`${combo} COMBO`, combo >= 5 ? 'critical' : 'combo');
  restartAnimation($('game-screen'), combo >= 5 ? 'combo-overdrive' : 'combo-aura');
}

function animateStabilityDamage(amount) {
  if (!amount) return;
  restartAnimation($('stability-wrap') || document.querySelector('.stability-wrap'), 'stability-hit');
  restartAnimation($('stability-value'), 'metric-damage');
  restartAnimation($('engineer-face'), amount >= 7 ? 'engineer-panic' : 'engineer-hit');
  screenFlash(amount >= 7 ? 'critical' : 'damage');
  showFloat(`安定度 -${amount}`, 'danger');
}

function animateMetric(id, delta, className) {
  if (!delta) return;
  restartAnimation($(id), className);
}

function criticalFlash(level) {
  screenFlash(level === 5 ? 'critical' : 'warning');
  restartAnimation($('board'), level === 5 ? 'critical-impact' : 'warning-impact');
}

function showFloat(text, tone) {
  const node = document.createElement('div');
  node.className = `float-text ${tone}`;
  node.textContent = text;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

function showScoreBurst(score) {
  if (!score) return;
  const node = document.createElement('div');
  node.className = 'score-burst';
  node.textContent = `+${Math.round(score * game.company.scoreRate)}`;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

function showBanner(text, tone = 'combo') {
  const node = document.createElement('div');
  node.className = `combo-banner ${tone}`;
  node.textContent = text;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

function showDayTransition(day, friday) {
  const node = document.createElement('div');
  node.className = `day-transition ${friday ? 'friday' : ''}`;
  node.innerHTML = `<small>${friday ? 'FRIDAY INCIDENT BOOST' : 'NEXT WORKDAY'}</small><strong>${day}日目</strong>`;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  if (friday) {
    screenFlash('critical');
    showParticles('danger', 20);
  }
}

function showParticles(tone = 'good', count = 14) {
  const rect = $('board').getBoundingClientRect();
  const layer = $('fx-layer');
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('i');
    particle.className = `particle ${tone}`;
    particle.style.left = `${rect.left + rect.width / 2}px`;
    particle.style.top = `${rect.top + rect.height / 2}px`;
    particle.style.setProperty('--x', `${(Math.random() - 0.5) * rect.width * 0.9}px`);
    particle.style.setProperty('--y', `${(Math.random() - 0.5) * rect.height * 0.9}px`);
    particle.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    particle.style.animationDelay = `${Math.random() * 80}ms`;
    layer.append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

function screenFlash(tone) {
  const node = document.createElement('div');
  node.className = `screen-flash ${tone}`;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

function createScanLines() {
  const node = document.createElement('div');
  node.className = 'scan-lines';
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

async function animatePatchBeam(tile, icon) {
  if (!tile) return;
  const rect = tile.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = 'patch-beam';
  node.innerHTML = `<span>🩹</span><b>${icon}</b>`;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height / 2}px`;
  $('fx-layer').append(node);
  restartAnimation(tile, 'patch-target');
  screenFlash('heal');
  await wait(520);
  node.remove();
}

function bumpBoard() {
  restartAnimation($('board'), 'bump');
}

function bumpTile(row, col) {
  const tile = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  restartAnimation(tile, 'bump-tile');
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function openDialog(id) { const dialog = $(id); if (!dialog.open) dialog.showModal(); }
function closeDialog(id) { const dialog = $(id); if (dialog.open) dialog.close(); }

$('start-button').addEventListener('click', startGame);
$('retry-button').addEventListener('click', startGame);
$('back-button').addEventListener('click', () => {
  hide('result-screen');
  show('title-screen');
  renderBest();
});
$('patch-mode-button').addEventListener('click', togglePatchMode);
$('howto-button').addEventListener('click', () => openDialog('howto-dialog'));
$('close-howto').addEventListener('click', () => closeDialog('howto-dialog'));
$('pause-button').addEventListener('click', () => openDialog('menu-dialog'));
$('resume-button').addEventListener('click', () => closeDialog('menu-dialog'));
$('retire-button').addEventListener('click', () => {
  closeDialog('menu-dialog');
  endGame('自主退職');
});

document.querySelectorAll('[data-move]').forEach((button) => {
  button.addEventListener('click', () => {
    restartAnimation(button, 'direction-press');
    move(button.dataset.move);
  });
});

$('board').addEventListener('touchstart', (event) => {
  if (game?.patchMode) return;
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

$('board').addEventListener('touchend', (event) => {
  if (!touchStart || game?.patchMode) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
}, { passive: true });

document.addEventListener('keydown', (event) => {
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (directions[event.key]) {
    event.preventDefault();
    move(directions[event.key]);
  }
});

renderCompanyOptions();
renderBest();
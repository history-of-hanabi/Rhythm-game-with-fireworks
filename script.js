// --- 基本設定 ---
const NOTE_SPEED = 2.2; // ノーツの落下速度(px/frame)
const JUDGE_LINE_Y = 410; // 判定ラインのY座標(canvas)
const JUDGE_WINDOW = { perfect: 40, good: 80 }; // ms
const NOTE_TYPES = [
  { img: "assets/hanabi1.png", name: "牡丹" },
  { img: "assets/hanabi2.png", name: "菊" },
  { img: "assets/hanabi3.png", name: "柳" }
];
const BGM_LIST = [
  { src: "assets/bgm1.mp3", name: "はなびのうた" },
  { src: "assets/bgm2.mp3", name: "なつまつりメロディ" }
];

// --- DOM取得 ---
const $menu = document.getElementById('menu');
const $game = document.getElementById('game');
const $result = document.getElementById('result');
const $tutorial = document.getElementById('tutorial');
const $closeTutorial = document.getElementById('close-tutorial');
const $howtoBtn = document.getElementById('howto-btn');
const $startBtn = document.getElementById('start-btn');
const $bgmSelect = document.getElementById('bgm-select');
const $score = document.getElementById('score');
const $combo = document.getElementById('combo');
const $noteCanvas = document.getElementById('note-canvas');
const ctx = $noteCanvas.getContext('2d');
const $judgement = document.getElementById('judgement');
const $touchArea = document.getElementById('touch-area');
const $bgm = document.getElementById('bgm');
const $seTap = document.getElementById('se-tap');
const $finalScore = document.getElementById('final-score');
const $finalCombo = document.getElementById('final-combo');
const $retryBtn = document.getElementById('retry-btn');
const $backBtn = document.getElementById('back-btn');

// --- ゲーム状態 ---
let notes = [];
let currentNote = 0;
let startTime = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let isPlaying = false;
let animationId = null;
let hanabiImgs = [];
let lastJudgementTimeout = null;

// --- ノーツ譜面サンプル ---
function generateNotes() {
  // 簡単な譜面例（BGM1: 4/4拍子, 2小節, 1小節=2秒, 8分音符）
  let notes = [];
  let bpm = 120, beat = 4, bars = 4;
  let interval = 60000 / bpm / 2; // 8分音符
  let time = 1000; // 1秒後から開始
  for (let i = 0; i < beat * 2 * bars; i++) {
    notes.push({
      time: time,
      type: Math.floor(Math.random() * NOTE_TYPES.length)
    });
    time += interval;
  }
  return notes;
}

// --- 画像プリロード ---
function preloadImages(arr, cb) {
  let loaded = 0;
  let imgs = [];
  arr.forEach((obj, i) => {
    let img = new Image();
    img.src = obj.img;
    img.onload = () => {
      loaded++;
      imgs[i] = img;
      if (loaded === arr.length) cb(imgs);
    };
  });
}

// --- ゲーム開始 ---
$startBtn.onclick = () => {
  $menu.classList.add('hidden');
  $result.classList.add('hidden');
  $game.classList.remove('hidden');
  $score.textContent = 0;
  $combo.textContent = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  notes = generateNotes();
  currentNote = 0;
  isPlaying = true;
  preloadImages(NOTE_TYPES, imgs => {
    hanabiImgs = imgs;
    startGame();
  });
};

// --- チュートリアル ---
$howtoBtn.onclick = () => {
  $tutorial.classList.remove('hidden');
};
$closeTutorial.onclick = () => {
  $tutorial.classList.add('hidden');
};

// --- ゲーム進行 ---
function startGame() {
  // BGMセット
  $bgm.src = $bgmSelect.value;
  $bgm.currentTime = 0;
  $bgm.play();
  startTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

// --- メインループ ---
function gameLoop(now) {
  if (!isPlaying) return;
  let elapsed = now - startTime;
  ctx.clearRect(0, 0, $noteCanvas.width, $noteCanvas.height);

  // ノーツ描画
  for (let i = currentNote; i < notes.length; i++) {
    let note = notes[i];
    let t = note.time - elapsed;
    let y = (t / 1000) * NOTE_SPEED * 60 + 60; // 落下式
    if (y > $noteCanvas.height) continue;
    if (y < -40) continue;
    let x = $noteCanvas.width / 2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(hanabiImgs[note.type], x - 32, y - 32, 64, 64);
    ctx.restore();
  }

  // Miss判定
  if (currentNote < notes.length) {
    let note = notes[currentNote];
    let t = note.time - elapsed;
    if (t < -JUDGE_WINDOW.good) {
      showJudgement("miss");
      combo = 0;
      $combo.textContent = combo;
      currentNote++;
    }
  }

  // 終了判定
  if (elapsed > notes[notes.length - 1].time + 2000) {
    endGame();
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

// --- タップ判定 ---
function handleTap(e) {
  if (!isPlaying) return;
  let now = performance.now() - startTime;
  if (currentNote >= notes.length) return;

  let note = notes[currentNote];
  let diff = Math.abs(now - note.time);
  if (diff <= JUDGE_WINDOW.perfect) {
    // Perfect
    showJudgement("perfect");
    addScore(100);
    combo++;
    maxCombo = Math.max(combo, maxCombo);
    $combo.textContent = combo;
    launchHanabi(note.type, "perfect");
    $seTap.currentTime = 0; $seTap.play();
    currentNote++;
  } else if (diff <= JUDGE_WINDOW.good) {
    // Good
    showJudgement("good");
    addScore(50);
    combo++;
    maxCombo = Math.max(combo, maxCombo);
    $combo.textContent = combo;
    launchHanabi(note.type, "good");
    $seTap.currentTime = 0; $seTap.play();
    currentNote++;
  } else {
    // 早すぎ/遅すぎ
    showJudgement("miss");
    combo = 0;
    $combo.textContent = combo;
  }
}

// --- 花火エフェクト ---
function launchHanabi(type, judge) {
  // 簡易：canvas上にカラフルな円を描画
  let colors = {
    perfect: ["#ff7eb9", "#7afcff", "#fff740", "#b967ff"],
    good: ["#c7ceea", "#b5ead7", "#ffdac1"],
    miss: ["#bdbdbd"]
  };
  let x = $noteCanvas.width / 2;
  let y = JUDGE_LINE_Y;
  let particles = [];
  for (let i = 0; i < 16; i++) {
    let angle = (i / 16) * Math.PI * 2;
    let r = Math.random() * 16 + 24;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * r,
      vy: Math.sin(angle) * r,
      color: colors[judge][i % colors[judge].length],
      alpha: 1
    });
  }
  let frame = 0;
  function drawHanabi() {
    frame++;
    ctx.save();
    ctx.globalAlpha = 0.7;
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x + p.vx * (frame / 16), p.y + p.vy * (frame / 16), 8 - frame / 4, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 18);
      ctx.fill();
    });
    ctx.restore();
    if (frame < 16) requestAnimationFrame(drawHanabi);
  }
  drawHanabi();
}

// --- スコア加算 ---
function addScore(val) {
  score += val;
  $score.textContent = score;
}

// --- ジャッジ表示 ---
function showJudgement(type) {
  if (lastJudgementTimeout) clearTimeout(lastJudgementTimeout);
  $judgement.textContent =
    type === "perfect" ? "Perfect!" :
    type === "good" ? "Good!" : "Miss...";
  $judgement.className = type;
  lastJudgementTimeout = setTimeout(() => {
    $judgement.textContent = "";
  }, 700);
}

// --- 終了処理 ---
function endGame() {
  isPlaying = false;
  $bgm.pause();
  cancelAnimationFrame(animationId);
  $game.classList.add('hidden');
  $result.classList.remove('hidden');
  $finalScore.textContent = score;
  $finalCombo.textContent = maxCombo;
}

// --- リトライ/メニュー ---
$retryBtn.onclick = () => {
  $result.classList.add('hidden');
  $menu.classList.add('hidden');
  $game.classList.remove('hidden');
  $score.textContent = 0;
  $combo.textContent = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  notes = generateNotes();
  currentNote = 0;
  isPlaying = true;
  preloadImages(NOTE_TYPES, imgs => {
    hanabiImgs = imgs;
    startGame();
  });
};

$backBtn.onclick = () => {
  $result.classList.add('hidden');
  $game.classList.add('hidden');
  $menu.classList.remove('hidden');
};

// --- タッチ・クリック対応 ---
$touchArea.addEventListener('touchstart', handleTap);
$touchArea.addEventListener('mousedown', handleTap);

// --- スマホでのダブルタップズーム防止 ---
document.addEventListener('touchstart', function(e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// --- 初期表示 ---
window.onload = () => {
  $menu.classList.remove('hidden');
  $game.classList.add('hidden');
  $result.classList.add('hidden');
  $tutorial.classList.remove('hidden');
};

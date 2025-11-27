/**
 * controllers/sketch.js — Unified model support
 * - Detects tile storage model (mapping vs display-array)
 * - shuffleTiles / swap / checkSolved work in either model
 * - UI handlers call shuffleTiles() which is unified
 */

const CANVAS_SIZE = 600;

// Shared state
let img = null;
let tiles = [];
let cols = 3;
let rows = 3;
let selected = -1;
let solved = false;
let tileW = 0;
let tileH = 0;

let timerInterval = null;
let timeLeft = 0;        
let isGameOver = false;

let levels = [];
let currentLevelIdx = 0;
let isLoading = true;

// p5 hooks
function preload() { }
function setup() {
  const c = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  c.parent('sketch-holder');
  tileW = Math.floor(width / cols);
  tileH = Math.floor(height / rows);
  attachUIHandlers(); // safe attach
  fetchLevelsAndStart();
}
function draw() {
  background(240);

  if (isLoading || !img || tiles.length === 0) {
    fill(80);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Memuat gambar...', width / 2, height / 2);
    return;
  }

  for (let i = 0; i < cols * rows; i++) {
    const t = getTileForDisplay(i);
    if (!t) continue;
    const destX = (i % cols) * tileW;
    const destY = Math.floor(i / cols) * tileH;
    image(img, destX, destY, tileW, tileH, t.sx, t.sy, t.sW, t.sH);
    stroke(255, 200); strokeWeight(1); noFill();
    rect(destX, destY, tileW, tileH);
    if (selected === i) {
      stroke(231, 76, 60); strokeWeight(3); noFill();
      rect(destX + 2, destY + 2, tileW - 4, tileH - 4);
      strokeWeight(1);
    }
  }

  if (solved) {
    fill(39, 174, 96, 200);
    noStroke();
    rect(0, 0, width, height);
    fill(255); textAlign(CENTER, CENTER); textSize(32);
    text('LEVEL SELESAI!', width / 2, height / 2);
  }
}

// Mouse interaction unified
function mousePressed() {
  if (isLoading || !img || solved) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  const c = Math.floor(mouseX / tileW);
  const r = Math.floor(mouseY / tileH);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  const idx = r * cols + c;

  if (selected === -1) {
    selected = idx;
  } else if (selected === idx) {
    selected = -1;
  } else {
    // swap using unified swap
    swapUnified(selected, idx);
    selected = -1;
  }
}


function startTimer(seconds) {
  stopTimer(); 
  timeLeft = seconds;
  isGameOver = false;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      handleGameOver();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (!el) return;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  el.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  
  el.style.color = timeLeft <= 10 ? 'red' : '#d35400';
}

function handleGameOver() {
  stopTimer();
  isGameOver = true;
  SoundManager.playFail();
  alert("Waktu Habis! Game Over.");
}

/* -------------------------
   Model detection + helpers
   ------------------------- */
function isDisplayModel() {
  // display-model: tiles.length == cols*rows and tiles[i].currentIndex === i for most i
  if (!tiles || tiles.length === 0) return false;
  if (tiles.length !== cols * rows) return false;
  // if all tiles[i].currentIndex === i (or most), treat as display model
  let allMatch = true;
  for (let i = 0; i < tiles.length; i++) {
    if (typeof tiles[i].currentIndex !== 'number' || tiles[i].currentIndex !== i) {
      allMatch = false;
      break;
    }
  }
  return allMatch;
}

// get tile object to DRAW at display position pos (0..n-1)
function getTileForDisplay(pos) {
  if (!tiles || tiles.length === 0) return null;
  if (isDisplayModel()) {
    return tiles[pos];
  } else {
    // mapping model: find tile whose currentIndex == pos
    return tiles.find(t => t.currentIndex === pos);
  }
}

/* -------------------------
   Unified swap / shuffle / check
   ------------------------- */
function swapUnified(posA, posB) {
  if (!tiles || tiles.length === 0) return;
  if (posA === posB) return;

  if (isDisplayModel()) {
    // swap positions in array
    const tmp = tiles[posA];
    tiles[posA] = tiles[posB];
    tiles[posB] = tmp;
    // maintain currentIndex fields
    tiles[posA].currentIndex = posA;
    tiles[posB].currentIndex = posB;
  } else {
    // mapping model: change currentIndex values
    const a = tiles.find(t => t.currentIndex === posA);
    const b = tiles.find(t => t.currentIndex === posB);
    if (!a || !b) return;
    const tmp = a.currentIndex;
    a.currentIndex = b.currentIndex;
    b.currentIndex = tmp;
  }

  // check solved
  if (checkSolvedUnified()) {
    solved = true;
    stopTimer();
    SoundManager.playWin();
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'block';
    console.log('[puzzle] solved (unified)');
  }
}

function shuffleTilesUnified() {
  if (!tiles || tiles.length === 0) return;
  const n = cols * rows;
  // create shuffled order array of positions
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  if (isDisplayModel()) {
    // build new display array: at pos p put tile whose correctIndex == order[p]
    const newTiles = new Array(n);
    for (let p = 0; p < n; p++) {
      const correctIdx = order[p];
      // find original tile by correctIndex (in current tiles array)
      const tileObj = tiles.find(t => t.correctIndex === correctIdx);
      if (!tileObj) {
        console.warn('shuffleUnified: missing tile for correctIndex', correctIdx);
        continue;
      }
      const clone = Object.assign({}, tileObj);
      clone.currentIndex = p;
      newTiles[p] = clone;
    }
    tiles = newTiles;
  } else {
    // mapping model: set each tile.currentIndex to its new position
    // for position p -> tile whose correctIndex == order[p] should be placed at p
    for (let p = 0; p < n; p++) {
      const correctIdx = order[p];
      const tileObj = tiles.find(t => t.correctIndex === correctIdx);
      if (!tileObj) {
        console.warn('shuffleUnified(mapping): missing tile for correctIndex', correctIdx);
        continue;
      }
      tileObj.currentIndex = p;
    }
  }

  selected = -1;
  solved = checkSolvedUnified();
  console.log('[puzzle] shuffled unified; solved=', solved);
}

function checkSolvedUnified() {
  const n = cols * rows;
  for (let pos = 0; pos < n; pos++) {
    const t = getTileForDisplay(pos);
    if (!t) return false;
    if (t.correctIndex !== pos) return false;
  }
  return true;
}

/* -------------------------
   Fallback initTilesLocal (create tiles array in mapping or display model)
   We will create tiles in mapping model (each tile has correctIndex + currentIndex).
   ------------------------- */
function initTilesLocal(totalWidth, totalHeight) {
  tiles = [];
  const imgW = (img && img.width) ? img.width : totalWidth;
  const imgH = (img && img.height) ? img.height : totalHeight;
  const srcTileW = Math.floor(imgW / cols);
  const srcTileH = Math.floor(imgH / rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      tiles.push({
        sx: c * srcTileW,
        sy: r * srcTileH,
        sW: srcTileW,
        sH: srcTileH,
        correctIndex: idx,
        currentIndex: idx
      });
    }
  }

  tileW = Math.floor(totalWidth / cols);
  tileH = Math.floor(totalHeight / rows);

  // shuffle into mapping model
  shuffleTilesUnified();
}

/* -------------------------
   Level/image loading + UI + helpers (same as previous robust file)
   ------------------------- */

function fetchLevelsAndStart() {
  fetch('/api/levels')
    .then(r => {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    })
    .then(data => {
      console.log('[levels] fetched', data);
      levels = data && data.length ? data : [{ level: 1, cols: 3, rows: 3, imageUrl: '/assets/ai-generated-8085814.jpg', name: 'Fallback' }];
      currentLevelIdx = 0;
      loadLevel(currentLevelIdx);
    })
    .catch(err => {
      console.error('[levels] fetch failed', err);
      levels = [{ level: 1, cols: 3, rows: 3, imageUrl: '/assets/ai-generated-8085814.jpg', name: 'Fallback' }];
      currentLevelIdx = 0;
      loadLevel(currentLevelIdx);
    });
}

// ---------- replace loadLevel with this enhanced version ----------
function loadLevel(idx) {
  isLoading = true;
  solved = false;
  selected = -1;
  isGameOver = false;
  stopTimer();
  tiles = [];

  SoundManager.stopBGM();

  if (idx >= levels.length) {
    alert('Selamat! Semua level selesai.');
    SoundManager.playFinish();
    isLoading = false;
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }

  currentLevelIdx = idx;
  const config = levels[currentLevelIdx];
  cols = config.cols || 3;
  rows = config.rows || 3;

  const levelNum = config.level || (currentLevelIdx + 1);
  
  let duration = 60;

  if (levelNum >= 8) {
    duration = 120;
  } else if (levelNum >= 4) {
    duration = 100;
  } else {
    duration = 60;
  }

  console.log(`[level] Memuat Level ${levelNum}. Target Waktu: ${duration} detik.`);
  // -------------------------

  let chosenUrl = config.imageUrl || '';

  if (config.randomize) {
    const sep = chosenUrl.includes('?') ? '&' : '?';
    chosenUrl = chosenUrl + sep + 'cb=' + Date.now();
  }

  let canvasUrl = chosenUrl;
  if (/^https?:\/\//i.test(chosenUrl)) {
    canvasUrl = '/api/image-proxy?url=' + encodeURIComponent(chosenUrl);
  } else {
    if (!canvasUrl.startsWith('/')) canvasUrl = '/' + canvasUrl;
  }

  const ref = document.getElementById('refImg');
  if (ref) ref.src = canvasUrl;

  updateUI(config);
  console.log('[level] loading', currentLevelIdx, '-> original:', config.imageUrl, 'chosen:', chosenUrl, 'canvasUrl:', canvasUrl);

  loadImage(canvasUrl,
    (imgLoaded) => {
      try { imgLoaded.resize(CANVAS_SIZE, CANVAS_SIZE); } catch (e) { }
      img = imgLoaded;
      window.img = img;
      tileW = Math.floor(width / cols);
      tileH = Math.floor(height / rows);

      if (typeof initTiles === 'function') {
        try { initTiles(width, height); } catch (e) { initTilesLocal(width, height); }
      } else {
        initTilesLocal(width, height);
      }

      isLoading = false;
      
      if (typeof startTimer === 'function') {
          startTimer(duration);
      }

      SoundManager.playBGM();

      console.log('[image] loaded & ready');
    },
    (err) => {
      console.error('[image] failed to load', canvasUrl, err);
      img = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
      img.background(200);
      img.fill(80);
      img.textAlign(CENTER, CENTER);
      img.textSize(14);
      img.text('Gagal memuat gambar', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      window.img = img;
      
      initTilesLocal(width, height);
      isLoading = false;
    }
  );
}

function updateUI(config) {
  const levelTitle = document.getElementById('levelTitle');
  if (levelTitle) levelTitle.textContent = 'Level ' + (config.level || (currentLevelIdx + 1));
  const puzzleName = document.getElementById('puzzleName');
  if (puzzleName) puzzleName.textContent = config.name || '';
  const puzzleDesc = document.getElementById('puzzleDesc');
  if (puzzleDesc) puzzleDesc.textContent = config.desc || '';
  const gridSize = document.getElementById('gridSize');
  if (gridSize) gridSize.textContent = `${cols} x ${rows}`;
  const diffBadge = document.getElementById('diffBadge');
  if (diffBadge) diffBadge.textContent = config.diff || '';
  const nextBtn = document.getElementById('nextLevelBtn');
  if (nextBtn) nextBtn.style.display = 'none';
}

/* UI wiring (ensure shuffle calls unified function) */
function attachUIHandlers() {
  if (attachUIHandlers._attached) return;
  attachUIHandlers._attached = true;

  function onShuffleClicked() {
    console.log('[ui] shuffle clicked');
    if (isLoading || solved) return;
    shuffleTilesUnified();
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        const newMute = muteBtn.cloneNode(true);
        muteBtn.replaceWith(newMute);
        
        document.getElementById('muteBtn').addEventListener('click', function() {
            this.textContent = SoundManager.toggleMute();
        });
    }
  }

  function onSolveClicked() {
    console.log('[ui] solve clicked');
    // simple solve: put tiles in correct order for display
    if (isDisplayModel()) {
      // make sure tiles array arranged in display order with correctIndex == position
      tiles.sort((a, b) => a.correctIndex - b.correctIndex);
      for (let i = 0; i < tiles.length; i++) tiles[i].currentIndex = i;
    } else {
      // mapping model: set currentIndex = correctIndex
      tiles.forEach(t => t.currentIndex = t.correctIndex);
    }
    solved = true;
    stopTimer();
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'block';
  }

  function onNextClicked() {
    loadLevel(currentLevelIdx + 1);
  }

  function attachNow() {
    const shuffleBtn = document.getElementById('shuffleBtn');
    const solveBtn = document.getElementById('solveBtn');
    const nextBtn = document.getElementById('nextLevelBtn');

    if (shuffleBtn) {
      shuffleBtn.replaceWith(shuffleBtn.cloneNode(true));
      document.getElementById('shuffleBtn').addEventListener('click', onShuffleClicked);
    }
    if (solveBtn) {
      solveBtn.replaceWith(solveBtn.cloneNode(true));
      document.getElementById('solveBtn').addEventListener('click', onSolveClicked);
    }
    if (nextBtn) {
      nextBtn.replaceWith(nextBtn.cloneNode(true));
      document.getElementById('nextLevelBtn').addEventListener('click', onNextClicked);
    }
    console.log('[ui] handlers attached (unified)');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') attachNow();
  else document.addEventListener('DOMContentLoaded', attachNow);
}

const SoundManager = {
    isMuted: false,
    _play: function(id) {
        if (this.isMuted) return;
        const el = document.getElementById(id);
        if (el) {
            el.currentTime = 0; 
            el.play().catch(e => console.log("Audio blocked (autplay policy):", e));
        }
    },

    _stop: function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.pause();
            el.currentTime = 0;
        }
    },

    playBGM: function() {
        if (this.isMuted) return;
        const el = document.getElementById('audio-bgm');
        if (el && el.paused) {
            el.volume = 0.5;
            el.play().catch(e => console.log("BGM blocked:", e));
        }
    },

    stopBGM: function() {
        this._stop('audio-bgm');
    },
    playWin: function() {
        this.stopBGM(); 
        this._play('audio-win');
    },
    playFail: function() {
        this.stopBGM();
        this._play('audio-fail');
    },
    playFinish: function() {
        this.stopBGM();
        this._play('audio-finish');
    },
    
    toggleMute: function() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM(); 
            this._stop('audio-win');
            this._stop('audio-fail');
            this._stop('audio-finish');
            return "🔇 Suara: OFF";
        } else {
            // Jika di-unmute saat game jalan, nyalakan BGM
            if (!solved && !isGameOver) this.playBGM();
            return "🔊 Suara: ON";
        }
    }
};

/* Expose for other modules or console debugging */
window.shuffleTiles = shuffleTilesUnified;
window.swapTiles = swapUnified;
window.checkSolvedUnified = checkSolvedUnified;
window.loadLevel = loadLevel;
window.loadNextLevel = () => loadLevel(currentLevelIdx + 1);

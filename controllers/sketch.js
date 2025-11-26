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
    text('Memuat gambar... lihat Console / Network', width / 2, height / 2);
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
  tiles = [];

  if (idx >= levels.length) {
    alert('Selamat! Semua level selesai.');
    isLoading = false;
    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }

  currentLevelIdx = idx;
  const config = levels[currentLevelIdx];
  cols = config.cols || 3;
  rows = config.rows || 3;

  // ---------- Determine actual image URL to use ----------
  let chosenUrl = config.imageUrl || '';

  // 1) If imageList present, pick random from it
  if (Array.isArray(config.imageList) && config.imageList.length > 0) {
    chosenUrl = config.imageList[Math.floor(Math.random() * config.imageList.length)];
    console.log('[level] picked from imageList ->', chosenUrl);
  }

  // 2) If imageUrl contains placeholder {rand} -> replace with random integer
  if (typeof chosenUrl === 'string' && chosenUrl.includes('{rand}')) {
    const r = Math.floor(Math.random() * 1000000);
    chosenUrl = chosenUrl.replace(/\{rand\}/g, String(r));
    console.log('[level] replaced {rand} ->', chosenUrl);
  }

  // 3) If config.randomize === true -> append cache-buster param
  if (config.randomize) {
    const sep = chosenUrl.includes('?') ? '&' : '?';
    chosenUrl = chosenUrl + sep + 'cb=' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    console.log('[level] randomize true -> appended cb param ->', chosenUrl);
  }

  // 4) If the URL is remote, we will request via proxy for CORS safety
  let canvasUrl = chosenUrl;
  if (/^https?:\/\//i.test(chosenUrl)) {
    // proxy the remote URL (proxy will fetch and return image)
    canvasUrl = '/api/image-proxy?url=' + encodeURIComponent(chosenUrl);
  } else {
    // ensure absolute path for local asset
    if (!canvasUrl.startsWith('/')) canvasUrl = '/' + canvasUrl;
  }

  // Set reference image to the same URL canvas will use (so reference equals puzzle)
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

      // init tiles (use puzzle.js's initTiles if exists)
      if (typeof initTiles === 'function') {
        try { initTiles(width, height); } catch (e) { initTilesLocal(width, height); }
      } else {
        initTilesLocal(width, height);
      }

      isLoading = false;
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

/* Expose for other modules or console debugging */
window.shuffleTiles = shuffleTilesUnified;
window.swapTiles = swapUnified;
window.checkSolvedUnified = checkSolvedUnified;
window.loadLevel = loadLevel;
window.loadNextLevel = () => loadLevel(currentLevelIdx + 1);

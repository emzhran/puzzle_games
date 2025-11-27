window.addEventListener('load', () => {
    const shuffleBtn = document.getElementById('shuffleBtn');
    const autoSolveBtn = document.getElementById('autoSolveBtn');

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            if (typeof window.shuffleTiles === 'function') window.shuffleTiles();
        });
    }

    if (autoSolveBtn) {
        autoSolveBtn.addEventListener('click', () => {
            if (typeof window.checkSolvedUnified === 'function') {
            }
        });
    }
});
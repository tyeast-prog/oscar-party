/* ===== Oscar Party — Live Scoreboard ===== */
(function () {
  const winnerCards = document.getElementById('winner-cards');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const noBallotsMsg = document.getElementById('no-ballots-msg');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const finalBanner = document.getElementById('final-banner');
  const finalWinnerName = document.getElementById('final-winner-name');
  const finalWinnerScore = document.getElementById('final-winner-score');

  function refresh() {
    renderWinnerCards();
    renderLeaderboard();
    renderProgress();
  }

  // --- Winner Selection Cards ---
  function renderWinnerCards() {
    const categories = OscarData.getCategories();
    const winners = OscarData.getWinners();

    winnerCards.innerHTML = '';

    if (categories.length === 0) {
      winnerCards.innerHTML = '<p class="alert alert-warning">No categories configured. Go to Setup first.</p>';
      return;
    }

    categories.forEach(cat => {
      const block = document.createElement('div');
      block.className = 'category-block';

      const hasWinner = !!winners[cat.name];
      if (hasWinner) block.style.borderColor = 'var(--gold)';

      let nomineesHtml = '';
      if (cat.nominees && cat.nominees.length > 0) {
        nomineesHtml = cat.nominees.map(n => {
          const isWinner = winners[cat.name] === n;
          return `<button class="nominee-btn${isWinner ? ' winner' : ''}"
                    data-category="${esc(cat.name)}" data-nominee="${esc(n)}">${esc(n)}</button>`;
        }).join('');
      } else {
        nomineesHtml = '<span style="color:var(--light-gray);font-size:0.9rem;">No nominees added</span>';
      }

      block.innerHTML = `
        <h3>${esc(cat.name)}${hasWinner ? ' <span style="font-size:0.8rem;color:var(--green);">&#10003;</span>' : ''}</h3>
        <div>${nomineesHtml}</div>
      `;

      winnerCards.appendChild(block);
    });

    // Bind nominee buttons
    winnerCards.querySelectorAll('.nominee-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const cat = e.target.dataset.category;
        const nominee = e.target.dataset.nominee;
        const current = OscarData.getWinners()[cat];

        if (current === nominee) {
          // Toggle off
          OscarData.clearWinner(cat);
        } else {
          OscarData.setWinner(cat, nominee);
        }
        refresh();
      });
    });
  }

  // --- Leaderboard ---
  function renderLeaderboard() {
    const board = OscarData.getLeaderboard();

    if (board.length === 0) {
      leaderboardBody.innerHTML = '';
      noBallotsMsg.classList.remove('hidden');
      return;
    }
    noBallotsMsg.classList.add('hidden');

    leaderboardBody.innerHTML = board.map((g, i) => {
      const rank = i + 1;
      const rowClass = rank === 1 ? 'leaderboard-row first' : '';
      return `<tr class="${rowClass}">
        <td>${rank}</td>
        <td>${esc(g.name)}</td>
        <td>${g.score}</td>
      </tr>`;
    }).join('');
  }

  // --- Progress ---
  function renderProgress() {
    const categories = OscarData.getCategories();
    const winners = OscarData.getWinners();
    const total = categories.length;
    const announced = Object.keys(winners).length;
    const pct = total > 0 ? Math.round((announced / total) * 100) : 0;

    progressBar.style.width = pct + '%';
    progressText.textContent = `${announced} / ${total} categories announced`;

    // Final winner
    if (total > 0 && announced === total) {
      const board = OscarData.getLeaderboard();
      if (board.length > 0) {
        finalWinnerName.textContent = board[0].name;
        finalWinnerScore.textContent = board[0].score;
        finalBanner.classList.remove('hidden');
      }
    } else {
      finalBanner.classList.add('hidden');
    }
  }

  // --- Real-time sync ---
  OscarData.onSync(msg => {
    if (msg.type === 'winners-updated' || msg.type === 'guest-updated' || msg.type === 'storage-change') {
      refresh();
    }
  });

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  refresh();
})();

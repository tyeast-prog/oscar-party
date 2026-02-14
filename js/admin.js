/* ===== Oscar Party — Admin Dashboard ===== */
(function () {
  const tableBody = document.getElementById('guest-table-body');
  const noGuestsMsg = document.getElementById('no-guests-msg');
  const reminderList = document.getElementById('reminder-list');
  const noRemindersMsg = document.getElementById('no-reminders-msg');
  const reminderAlert = document.getElementById('reminder-alert');
  const btnCopyReminders = document.getElementById('btn-copy-reminders');

  function refresh() {
    renderStats();
    renderTable();
    renderReminders();
  }

  // --- Stats ---
  function renderStats() {
    const guests = OscarData.getGuests();
    document.getElementById('stat-total').textContent = guests.length;
    document.getElementById('stat-yes').textContent = guests.filter(g => g.rsvp === 'yes').length;
    document.getElementById('stat-no').textContent = guests.filter(g => g.rsvp === 'no').length;
    document.getElementById('stat-ballots').textContent = guests.filter(g => g.ballotSubmitted).length;

    const days = OscarData.daysUntilShow();
    document.getElementById('stat-days').textContent = days !== null ? days : '—';
  }

  // --- Guest Table ---
  function renderTable() {
    const guests = OscarData.getGuests();
    if (guests.length === 0) {
      tableBody.innerHTML = '';
      noGuestsMsg.classList.remove('hidden');
      return;
    }
    noGuestsMsg.classList.add('hidden');

    tableBody.innerHTML = guests.map(g => {
      const rsvpBadge = g.rsvp === 'yes'
        ? '<span class="badge badge-yes">Yes</span>'
        : g.rsvp === 'no'
          ? '<span class="badge badge-no">No</span>'
          : '<span class="badge badge-pending">—</span>';

      const ballotBadge = g.ballotSubmitted
        ? '<span class="badge badge-yes">Submitted</span>'
        : '<span class="badge badge-pending">Pending</span>';

      const time = g.submittedAt
        ? new Date(g.submittedAt).toLocaleString()
        : '—';

      // Party info: show "Party of N" for host, "^ party member" for others
      let partyLabel = '—';
      if (g.partyId && g.isPartyHost) {
        partyLabel = 'Party of ' + (g.partySize || 1);
      } else if (g.partyId) {
        partyLabel = 'member';
      }

      return `<tr>
        <td>${esc(g.name)}</td>
        <td>${esc(g.phone || '—')}</td>
        <td>${rsvpBadge}</td>
        <td>${partyLabel}</td>
        <td>${esc(g.dietary || '—')}</td>
        <td>${ballotBadge}</td>
        <td>${time}</td>
        <td><button class="btn btn-danger btn-sm btn-delete-guest" data-id="${g.id}" data-party-id="${g.partyId || ''}">Delete</button></td>
      </tr>`;
    }).join('');

    tableBody.querySelectorAll('.btn-delete-guest').forEach(btn => {
      btn.addEventListener('click', e => {
        if (confirm('Delete this guest?')) {
          OscarData.deleteGuest(e.target.dataset.id);
          refresh();
        }
      });
    });
  }

  // --- Reminders ---
  function renderReminders() {
    const guests = OscarData.getGuests();
    const needReminder = guests.filter(g => g.rsvp === 'yes' && !g.ballotSubmitted);
    const days = OscarData.daysUntilShow();

    reminderList.innerHTML = '';
    btnCopyReminders.classList.add('hidden');

    if (needReminder.length === 0) {
      noRemindersMsg.classList.remove('hidden');
      reminderAlert.classList.add('hidden');
      return;
    }

    noRemindersMsg.classList.add('hidden');

    // Urgency alert
    if (days !== null && days <= 5 && days >= 0) {
      reminderAlert.className = 'alert alert-danger';
      reminderAlert.textContent = `Only ${days} day${days !== 1 ? 's' : ''} until the show! ${needReminder.length} guest${needReminder.length !== 1 ? 's' : ''} still need${needReminder.length === 1 ? 's' : ''} to submit predictions.`;
      reminderAlert.classList.remove('hidden');
    } else {
      reminderAlert.classList.add('hidden');
    }

    needReminder.forEach(g => {
      const li = document.createElement('li');
      li.style.padding = '0.3rem 0';
      li.style.borderBottom = '1px solid var(--medium-gray)';
      li.textContent = g.name;
      if (days !== null && days <= 5 && days >= 0) {
        li.classList.add('highlight-row');
        li.style.padding = '0.4rem 0.5rem';
      }
      reminderList.appendChild(li);
    });

    btnCopyReminders.classList.remove('hidden');
  }

  // --- Copy reminders ---
  btnCopyReminders.addEventListener('click', () => {
    const guests = OscarData.getGuests();
    const needReminder = guests.filter(g => g.rsvp === 'yes' && !g.ballotSubmitted);
    const text = 'Ballot reminder needed:\n' + needReminder.map(g => '- ' + g.name).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      btnCopyReminders.textContent = 'Copied!';
      setTimeout(() => { btnCopyReminders.textContent = 'Copy Reminder List'; }, 2000);
    });
  });

  // --- Export ---
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    OscarData.downloadCSV();
  });

  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });

  // --- Real-time sync ---
  OscarData.onSync(msg => {
    if (msg.type === 'guest-updated' || msg.type === 'storage-change') {
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

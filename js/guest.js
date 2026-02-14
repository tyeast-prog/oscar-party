/* ===== Oscar Party — Guest Form ===== */
(function () {
  const formSection = document.getElementById('form-section');
  const confirmSection = document.getElementById('confirmation-section');
  const predictionsSection = document.getElementById('predictions-section');
  const predictionsContainer = document.getElementById('predictions-container');
  const formMsg = document.getElementById('form-msg');
  const lookupMsg = document.getElementById('lookup-msg');
  const partySizeSection = document.getElementById('party-size-section');
  const partySizeInput = document.getElementById('party-size');
  const partyNamesContainer = document.getElementById('party-names-container');

  let editingPartyId = null; // set when editing an existing party submission

  // --- Init ---
  function init() {
    bindRSVP();
    partySizeInput.addEventListener('input', onPartyChange);
  }

  // --- Collect current list of all person names in the party ---
  function getPersonNames() {
    const primary = document.getElementById('guest-name').value.trim() || 'You';
    const count = parseInt(partySizeInput.value, 10) || 1;
    const names = [primary];
    for (let i = 0; i < count - 1; i++) {
      const input = document.getElementById('party-name-' + i);
      names.push(input ? (input.value.trim() || 'Guest ' + (i + 2)) : 'Guest ' + (i + 2));
    }
    return names;
  }

  // --- Render party name inputs ---
  function renderPartyNames() {
    const count = parseInt(partySizeInput.value, 10) || 1;
    const extra = Math.max(0, count - 1);
    // Preserve existing values
    const existing = [];
    partyNamesContainer.querySelectorAll('.party-name-input').forEach(el => existing.push(el.value));

    partyNamesContainer.innerHTML = '';
    for (let i = 0; i < extra; i++) {
      const group = document.createElement('div');
      group.className = 'form-group';
      group.innerHTML = `
        <label for="party-name-${i}">Guest ${i + 2} Name</label>
        <input type="text" id="party-name-${i}" class="party-name-input" placeholder="Guest name">
      `;
      partyNamesContainer.appendChild(group);
      // Restore value if it existed
      if (existing[i] !== undefined) {
        group.querySelector('input').value = existing[i];
      }
    }
    // Add blur listeners to update prediction section headers when names change
    partyNamesContainer.querySelectorAll('.party-name-input').forEach(el => {
      el.addEventListener('blur', updatePredictionHeaders);
    });
  }

  // Called when party size or names change
  function onPartyChange() {
    renderPartyNames();
    buildPredictions();
  }

  // Update just the headers (no dropdown rebuild) when a name changes
  function updatePredictionHeaders() {
    const names = getPersonNames();
    predictionsContainer.querySelectorAll('.person-predictions').forEach((block, i) => {
      const h3 = block.querySelector('h3');
      if (h3 && names[i]) h3.textContent = names[i] + "'s Predictions";
    });
  }

  // Also rebuild predictions when the primary name changes
  document.getElementById('guest-name').addEventListener('blur', updatePredictionHeaders);

  // --- Build prediction dropdowns — one block per person ---
  function buildPredictions() {
    const categories = OscarData.getCategories();
    // Save current selections before rebuilding
    const saved = savePredictionState();

    predictionsContainer.innerHTML = '';

    if (categories.length === 0) {
      predictionsContainer.innerHTML = '<p class="alert alert-warning">No categories configured yet. Ask the admin to set up categories first.</p>';
      return;
    }

    const names = getPersonNames();
    names.forEach((personName, pi) => {
      const block = document.createElement('div');
      block.className = 'person-predictions category-block';
      block.dataset.personIndex = pi;

      let html = `<h3>${esc(personName)}'s Predictions</h3>`;
      categories.forEach(cat => {
        if (!cat.nominees || cat.nominees.length === 0) return;
        const selId = `pred-${pi}-${slug(cat.name)}`;
        html += `<div class="form-group">
          <label for="${selId}">${esc(cat.name)}</label>
          <select id="${selId}" data-person="${pi}" data-category="${esc(cat.name)}">
            <option value="">— Select —</option>
            ${cat.nominees.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
          </select>
        </div>`;
      });

      predictionsContainer.appendChild(block);
      block.innerHTML = html;
    });

    // Restore saved selections
    restorePredictionState(saved);
  }

  function savePredictionState() {
    const state = {};
    predictionsContainer.querySelectorAll('select').forEach(sel => {
      const key = sel.dataset.person + '|' + sel.dataset.category;
      if (sel.value) state[key] = sel.value;
    });
    return state;
  }

  function restorePredictionState(state) {
    predictionsContainer.querySelectorAll('select').forEach(sel => {
      const key = sel.dataset.person + '|' + sel.dataset.category;
      if (state[key]) sel.value = state[key];
    });
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // --- Show/hide predictions & party size based on RSVP ---
  function bindRSVP() {
    document.querySelectorAll('input[name="rsvp"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const val = document.querySelector('input[name="rsvp"]:checked')?.value;
        if (val === 'yes') {
          predictionsSection.classList.remove('hidden');
          partySizeSection.classList.remove('hidden');
          renderPartyNames();
          buildPredictions();
        } else {
          predictionsSection.classList.add('hidden');
          partySizeSection.classList.add('hidden');
        }
      });
    });
  }

  // --- Lookup ---
  document.getElementById('btn-lookup').addEventListener('click', () => {
    const name = document.getElementById('lookup-name').value.trim();
    if (!name) {
      showMsg(lookupMsg, 'Please enter your name.', 'warning');
      return;
    }
    const guest = OscarData.findGuestByName(name);
    if (!guest) {
      showMsg(lookupMsg, 'No submission found for that name.', 'warning');
      return;
    }
    // Load the full party if this guest has a partyId
    if (guest.partyId) {
      editingPartyId = guest.partyId;
      const party = OscarData.getGuestsByPartyId(guest.partyId);
      populateFormFromParty(party);
    } else {
      editingPartyId = guest.id; // solo guest, use their id as partyId
      populateFormFromParty([guest]);
    }
    showMsg(lookupMsg, 'Found your submission! Edit below and re-submit.', 'success');
  });

  function populateFormFromParty(party) {
    // The host is the first member (isPartyHost or index 0)
    const host = party.find(g => g.isPartyHost) || party[0];
    if (!host) return;

    document.getElementById('guest-name').value = host.name || '';
    document.getElementById('dietary').value = host.dietary || '';

    // RSVP
    const rsvpRadio = document.querySelector(`input[name="rsvp"][value="${host.rsvp}"]`);
    if (rsvpRadio) {
      rsvpRadio.checked = true;
    }

    // Party size & names
    if (host.rsvp === 'yes') {
      partySizeSection.classList.remove('hidden');
      predictionsSection.classList.remove('hidden');
      partySizeInput.value = party.length;
      renderPartyNames();
      // Fill in additional guest names
      const others = party.filter(g => g !== host);
      others.forEach((g, i) => {
        const input = document.getElementById('party-name-' + i);
        if (input) input.value = g.name || '';
      });

      // Build predictions then populate
      buildPredictions();
      party.forEach((g, pi) => {
        if (g.predictions) {
          for (const [cat, pick] of Object.entries(g.predictions)) {
            const sel = predictionsContainer.querySelector(`select[data-person="${pi}"][data-category="${cat}"]`);
            if (sel) sel.value = pick;
          }
        }
      });
    }
  }

  // --- Submit ---
  document.getElementById('btn-submit').addEventListener('click', () => {
    const name = document.getElementById('guest-name').value.trim();
    const rsvp = document.querySelector('input[name="rsvp"]:checked')?.value;
    const dietary = document.getElementById('dietary').value.trim();

    if (!name) { showMsg(formMsg, 'Please enter your name.', 'danger'); return; }
    if (!rsvp) { showMsg(formMsg, 'Please select RSVP status.', 'danger'); return; }

    // Check for duplicate primary name (if not editing)
    if (!editingPartyId) {
      const existing = OscarData.findGuestByName(name);
      if (existing) {
        showMsg(formMsg, 'A submission with that name already exists. Use the lookup above to edit it.', 'warning');
        return;
      }
    }

    const now = new Date().toISOString();

    if (rsvp === 'no') {
      // Single record, no party
      if (editingPartyId) {
        // Delete old party members first
        OscarData.deleteGuestsByPartyId(editingPartyId);
      }
      OscarData.saveGuest({
        name, rsvp, dietary,
        partySize: 1, partyNames: [],
        predictions: {}, ballotSubmitted: false,
        submittedAt: now,
      });
      showConfirmation(name, rsvp, 0, 1);
      return;
    }

    // RSVP = yes — create one record per person
    const personNames = getPersonNames();
    const partySize = personNames.length;

    // Validate that additional guest names aren't empty
    for (let i = 1; i < personNames.length; i++) {
      if (personNames[i] === 'Guest ' + (i + 1)) {
        showMsg(formMsg, `Please enter a name for Guest ${i + 1}.`, 'danger');
        return;
      }
    }

    // Check for duplicate names among party members
    const lowerNames = personNames.map(n => n.toLowerCase());
    const uniqueNames = new Set(lowerNames);
    if (uniqueNames.size !== lowerNames.length) {
      showMsg(formMsg, 'Each party member must have a unique name.', 'danger');
      return;
    }

    // Check if any party member name conflicts with an existing guest outside this party
    for (const pName of personNames) {
      const existing = OscarData.findGuestByName(pName);
      if (existing && existing.partyId !== editingPartyId && existing.id !== editingPartyId) {
        showMsg(formMsg, `"${pName}" is already registered by someone else. Use a different name or look them up.`, 'warning');
        return;
      }
    }

    // Delete old party members if editing
    if (editingPartyId) {
      OscarData.deleteGuestsByPartyId(editingPartyId);
    }

    // Generate shared partyId
    const partyId = editingPartyId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    let totalPredictions = 0;

    personNames.forEach((pName, pi) => {
      const predictions = {};
      predictionsContainer.querySelectorAll(`select[data-person="${pi}"]`).forEach(sel => {
        if (sel.value) predictions[sel.dataset.category] = sel.value;
      });
      const ballotSubmitted = Object.keys(predictions).length > 0;
      if (ballotSubmitted) totalPredictions++;

      OscarData.saveGuest({
        name: pName,
        rsvp: 'yes',
        dietary: pi === 0 ? dietary : '',
        partyId,
        partySize,
        isPartyHost: pi === 0,
        predictions,
        ballotSubmitted,
        submittedAt: now,
      });
    });

    showConfirmation(name, rsvp, totalPredictions, partySize);
  });

  function showConfirmation(name, rsvp, ballotsCount, partySize) {
    formSection.classList.add('hidden');
    document.getElementById('lookup-section').classList.add('hidden');
    confirmSection.classList.remove('hidden');

    const confirmText = document.getElementById('confirm-text');
    if (rsvp === 'yes' && partySize > 1) {
      confirmText.textContent = `Thanks, ${name}! Your party of ${partySize} has been registered with ${ballotsCount} ballot${ballotsCount !== 1 ? 's' : ''} submitted.`;
    } else if (rsvp === 'yes') {
      confirmText.textContent = `Thanks, ${name}! Your RSVP and predictions have been saved.`;
    } else {
      confirmText.textContent = `Got it, ${name}. Sorry you can't make it!`;
    }
    editingPartyId = null;
  }

  // --- Edit again ---
  document.getElementById('btn-edit').addEventListener('click', () => {
    confirmSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    document.getElementById('lookup-section').classList.remove('hidden');
  });

  // --- Helpers ---
  function showMsg(el, text, type) {
    el.className = `alert alert-${type}`;
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  init();
})();

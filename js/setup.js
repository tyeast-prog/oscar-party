/* ===== Oscar Party — Setup Page ===== */
(function () {
  const container = document.getElementById('categories-container');
  const showDateInput = document.getElementById('show-date');
  const saveMsg = document.getElementById('save-msg');

  let categories = [];

  // --- Init ---
  function init() {
    categories = OscarData.getCategories();
    if (categories.length === 0) {
      categories = OscarData.getDefaultCategories();
    }
    showDateInput.value = OscarData.getShowDate() || '';
    render();
  }

  // --- Render all category blocks ---
  function render() {
    container.innerHTML = '';
    categories.forEach((cat, ci) => {
      const block = document.createElement('div');
      block.className = 'category-block fade-in';
      block.innerHTML = `
        <h3>
          <input type="text" value="${esc(cat.name)}" data-ci="${ci}" class="cat-name-input"
                 style="background:transparent;border:none;color:var(--gold);font-family:Georgia,serif;font-size:1.05rem;font-weight:700;padding:0;width:70%;">
          <button class="btn btn-danger btn-sm btn-remove-cat" data-ci="${ci}">Remove</button>
        </h3>
        <div class="nominee-list" data-ci="${ci}">
          ${cat.nominees.map((n, ni) => nomineeRow(ci, ni, n)).join('')}
        </div>
        <button class="btn btn-outline btn-sm btn-add-nominee" data-ci="${ci}" style="margin-top:0.5rem;">+ Add Nominee</button>
      `;
      container.appendChild(block);
    });

    // Bind events
    container.querySelectorAll('.cat-name-input').forEach(el => {
      el.addEventListener('change', e => {
        categories[+e.target.dataset.ci].name = e.target.value.trim();
      });
    });
    container.querySelectorAll('.btn-remove-cat').forEach(el => {
      el.addEventListener('click', e => {
        categories.splice(+e.target.dataset.ci, 1);
        render();
      });
    });
    container.querySelectorAll('.btn-add-nominee').forEach(el => {
      el.addEventListener('click', e => {
        categories[+e.target.dataset.ci].nominees.push('');
        render();
        // Focus the new input
        const list = container.querySelector(`.nominee-list[data-ci="${e.target.dataset.ci}"]`);
        const inputs = list.querySelectorAll('input');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
    });
    container.querySelectorAll('.nominee-input').forEach(el => {
      el.addEventListener('change', e => {
        const ci = +e.target.dataset.ci;
        const ni = +e.target.dataset.ni;
        categories[ci].nominees[ni] = e.target.value.trim();
      });
    });
    container.querySelectorAll('.btn-remove-nominee').forEach(el => {
      el.addEventListener('click', e => {
        const ci = +e.target.dataset.ci;
        const ni = +e.target.dataset.ni;
        categories[ci].nominees.splice(ni, 1);
        render();
      });
    });
  }

  function nomineeRow(ci, ni, value) {
    return `<div class="nominee-row">
      <input type="text" class="nominee-input" value="${esc(value)}" placeholder="Nominee name"
             data-ci="${ci}" data-ni="${ni}">
      <button class="btn btn-danger btn-sm btn-remove-nominee" data-ci="${ci}" data-ni="${ni}">X</button>
    </div>`;
  }

  function esc(str) {
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // --- Save ---
  document.getElementById('btn-save').addEventListener('click', () => {
    // Read latest values from DOM before saving
    container.querySelectorAll('.cat-name-input').forEach(el => {
      categories[+el.dataset.ci].name = el.value.trim();
    });
    container.querySelectorAll('.nominee-input').forEach(el => {
      categories[+el.dataset.ci].nominees[+el.dataset.ni] = el.value.trim();
    });

    // Clean: remove empty nominees, remove categories without names
    categories = categories
      .filter(c => c.name)
      .map(c => ({ ...c, nominees: c.nominees.filter(n => n) }));

    OscarData.saveCategories(categories);
    OscarData.setShowDate(showDateInput.value);

    saveMsg.classList.remove('hidden');
    setTimeout(() => saveMsg.classList.add('hidden'), 2500);
  });

  // --- Add Category ---
  document.getElementById('btn-add-category').addEventListener('click', () => {
    categories.push({ name: '', nominees: [] });
    render();
    // Focus the new category name input
    const inputs = container.querySelectorAll('.cat-name-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  // --- Reset to Defaults ---
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all categories to defaults? Existing nominees will be lost.')) {
      categories = OscarData.getDefaultCategories();
      render();
    }
  });

  init();
})();

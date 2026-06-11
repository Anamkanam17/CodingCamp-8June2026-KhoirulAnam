// ── State ──────────────────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let nextId = parseInt(localStorage.getItem('nextId') || '1');

// Built-in categories (can be extended by the user)
const DEFAULT_CATEGORIES = [
    { value: 'Food', label: '🍛 Food' },
    { value: 'Drink', label: '🥤 Drink' },
    { value: 'Snack', label: '🍿 Snack' },
    { value: 'Dessert', label: '🍰 Dessert' },
    { value: 'Other', label: '📦 Other' },
];

let customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');

// Current sort order
let currentSort = localStorage.getItem('sortOrder') || 'default';

// Colour palette — built-ins first, extras generated
const BASE_COLORS = {
    'Food': '#667eea',
    'Drink': '#48bb78',
    'Snack': '#ed8936',
    'Dessert': '#ed64a6',
    'Other': '#a0aec0',
};

// Extra palette for custom categories (cycles if many are added)
const EXTRA_PALETTE = [
    '#f6ad55', '#68d391', '#63b3ed', '#fc8181', '#b794f4',
    '#76e4f7', '#f687b3', '#fbd38d', '#9ae6b4', '#90cdf4',
];

function getCategoryColor(cat) {
    if (BASE_COLORS[cat]) return BASE_COLORS[cat];
    const idx = customCategories.indexOf(cat);
    return EXTRA_PALETTE[idx % EXTRA_PALETTE.length] || '#a0aec0';
}

// ── Dark / Light Mode ──────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
let isDark = localStorage.getItem('theme') === 'dark';

function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    // Update chart colours to match theme
    updateChartTheme();
}

themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
});

function updateChartTheme() {
    const textColor = isDark ? '#e2e8f0' : '#4a5568';
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
}

// ── Chart Setup ────────────────────────────────────────────────────────
const chartCtx = document.getElementById('spending-chart').getContext('2d');
const chart = new Chart(chartCtx, {
    type: 'pie',
    data: {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: [],
            borderWidth: 2,
            borderColor: '#fff',
        }],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { font: { size: 12 }, padding: 16, color: '#4a5568' },
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.parsed;
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total ? ((val / total) * 100).toFixed(1) : 0;
                        return ` Rp ${val.toLocaleString('id-ID')} (${pct}%)`;
                    },
                },
            },
        },
    },
});

// ── Storage Helpers ────────────────────────────────────────────────────
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('nextId', String(nextId));
}

function saveCustomCategories() {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
}

function formatRupiah(n) {
    return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Category Select Helpers ────────────────────────────────────────────
const categorySelect = document.getElementById('input-category');
const customGroup = document.getElementById('custom-category-group');
const customInput = document.getElementById('input-custom-category');
const CUSTOM_SENTINEL = '__custom__';

/** Rebuild the <select> from built-ins + saved custom categories */
function rebuildCategorySelect(selectedValue) {
    // Keep the placeholder option
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';

    [...DEFAULT_CATEGORIES, ...customCategories.map(c => ({ value: c, label: `🏷️ ${c}` }))]
        .forEach(({ value, label }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (value === selectedValue) opt.selected = true;
            categorySelect.appendChild(opt);
        });

    // "Add custom category…" option at the bottom
    const addOpt = document.createElement('option');
    addOpt.value = CUSTOM_SENTINEL;
    addOpt.textContent = '➕ Add custom category…';
    categorySelect.appendChild(addOpt);
}

categorySelect.addEventListener('change', () => {
    if (categorySelect.value === CUSTOM_SENTINEL) {
        customGroup.hidden = false;
        customInput.focus();
    } else {
        customGroup.hidden = true;
        categorySelect.classList.remove('error');
        document.getElementById('err-category').classList.remove('visible');
    }
    document.getElementById('err-custom-category').classList.remove('visible');
    customInput.classList.remove('error');
});

document.getElementById('btn-save-category').addEventListener('click', () => {
    const name = customInput.value.trim();
    if (!name) {
        customInput.classList.add('error');
        document.getElementById('err-custom-category').classList.add('visible');
        return;
    }

    // Avoid duplicates (case-insensitive)
    const exists = [...DEFAULT_CATEGORIES.map(c => c.value.toLowerCase()),
    ...customCategories.map(c => c.toLowerCase())]
        .includes(name.toLowerCase());
    if (!exists) {
        customCategories.push(name);
        saveCustomCategories();
    }

    rebuildCategorySelect(name); // re-render and pre-select the new category
    customGroup.hidden = true;
    customInput.value = '';
    customInput.classList.remove('error');
    document.getElementById('err-custom-category').classList.remove('visible');
    document.getElementById('err-category').classList.remove('visible');
    categorySelect.classList.remove('error');
});

// ── Sort Helpers ───────────────────────────────────────────────────────
const sortSelect = document.getElementById('sort-select');
sortSelect.value = currentSort;

sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    localStorage.setItem('sortOrder', currentSort);
    renderList();
});

function getSortedTransactions() {
    const arr = [...transactions];
    switch (currentSort) {
        case 'amount-desc': return arr.sort((a, b) => b.amount - a.amount);
        case 'amount-asc': return arr.sort((a, b) => a.amount - b.amount);
        case 'category-asc': return arr.sort((a, b) => a.category.localeCompare(b.category));
        case 'category-desc': return arr.sort((a, b) => b.category.localeCompare(a.category));
        default: return arr.reverse(); // newest first
    }
}

// ── Render ─────────────────────────────────────────────────────────────
function render() {
    renderList();
    renderBalance();
    renderChart();
}

function renderList() {
    const listEl = document.getElementById('transaction-list');
    const emptyEl = document.getElementById('empty-state');

    listEl.querySelectorAll('.transaction-item').forEach(el => el.remove());

    if (transactions.length === 0) {
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';

    getSortedTransactions().forEach(tx => {
        const color = getCategoryColor(tx.category);
        const item = document.createElement('div');

        item.className = 'transaction-item';
        item.dataset.id = tx.id;
        item.style.borderLeftColor = color;

        item.innerHTML = `
            <div class="item-left">
                <span class="item-name">${escapeHtml(tx.name)}</span>
                <span class="item-category" style="background:${color}">${escapeHtml(tx.category)}</span>
            </div>
            <div class="item-right">
                <span class="item-amount">${formatRupiah(tx.amount)}</span>
                <button class="btn-delete" data-id="${tx.id}"
                    title="Delete" aria-label="Delete ${escapeHtml(tx.name)}">🗑️</button>
            </div>
        `;

        listEl.appendChild(item);
    });
}

function renderBalance() {
    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    document.getElementById('total-balance').textContent = formatRupiah(total);
}

function renderChart() {
    const emptyMsg = document.getElementById('chart-empty');
    const chartCanvas = document.getElementById('spending-chart');

    if (transactions.length === 0) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.data.datasets[0].backgroundColor = [];
        chart.update();
        chartCanvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    chartCanvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const totals = {};
    transactions.forEach(tx => {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
    });

    chart.data.labels = Object.keys(totals);
    chart.data.datasets[0].data = Object.values(totals);
    chart.data.datasets[0].backgroundColor = Object.keys(totals).map(getCategoryColor);
    chart.update();
}

// ── Form Submission ────────────────────────────────────────────────────
document.getElementById('transaction-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const nameEl = document.getElementById('input-name');
    const amountEl = document.getElementById('input-amount');
    const customCatEl = document.getElementById('input-custom-category');

    let valid = true;

    // Validate name
    if (!nameEl.value.trim()) {
        setError(nameEl, 'err-name', true);
        valid = false;
    } else {
        setError(nameEl, 'err-name', false);
    }

    // Validate amount
    const amt = parseFloat(amountEl.value);
    if (!amountEl.value || isNaN(amt) || amt <= 0) {
        setError(amountEl, 'err-amount', true);
        valid = false;
    } else {
        setError(amountEl, 'err-amount', false);
    }

    // Validate category
    const isCustomPending = categorySelect.value === CUSTOM_SENTINEL;
    if (!categorySelect.value || isCustomPending) {
        setError(categorySelect, 'err-category', true);
        valid = false;
        if (isCustomPending && !customCatEl.value.trim()) {
            setError(customCatEl, 'err-custom-category', true);
        }
    } else {
        setError(categorySelect, 'err-category', false);
    }

    if (!valid) return;

    transactions.push({
        id: nextId++,
        name: nameEl.value.trim(),
        amount: amt,
        category: categorySelect.value,
    });

    saveTransactions();
    render();
    this.reset();
    // reset() clears the select, so re-sync custom group visibility
    customGroup.hidden = true;
});

// ── Delete ─────────────────────────────────────────────────────────────
document.getElementById('transaction-list').addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;

    const id = parseInt(btn.dataset.id);
    transactions = transactions.filter(tx => tx.id !== id);
    saveTransactions();
    render();
});

// ── Validation Helper ──────────────────────────────────────────────────
function setError(inputEl, errId, hasError) {
    const errEl = document.getElementById(errId);
    if (hasError) {
        inputEl.classList.add('error');
        errEl.classList.add('visible');
    } else {
        inputEl.classList.remove('error');
        errEl.classList.remove('visible');
    }
}

// Clear errors live
['input-name', 'input-amount'].forEach(id => {
    document.getElementById(id).addEventListener('input', function () {
        this.classList.remove('error');
    });
});

// ── Init ───────────────────────────────────────────────────────────────
rebuildCategorySelect();   // populate select with built-ins + any saved customs
applyTheme();              // apply saved theme preference
render();

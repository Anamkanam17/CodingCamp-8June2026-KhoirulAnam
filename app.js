// ── State ──────────────────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let nextId = parseInt(localStorage.getItem('nextId') || '1');

// Warna per kategori (dipakai di chart & badge)
const CATEGORY_COLORS = {
    'Food': '#667eea',
    'Drink': '#48bb78',
    'Snack': '#ed8936',
    'Dessert': '#ed64a6',
    'Other': '#a0aec0',
};

// ── Chart Setup ────────────────────────────────────────────────────────
const chartCanvas = document.getElementById('spending-chart').getContext('2d');
const chart = new Chart(chartCanvas, {
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
                labels: { font: { size: 12 }, padding: 16 },
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
function saveToStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('nextId', String(nextId));
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

// ── Render ─────────────────────────────────────────────────────────────
function render() {
    renderList();
    renderBalance();
    renderChart();
}

function renderList() {
    const listEl = document.getElementById('transaction-list');
    const emptyEl = document.getElementById('empty-state');

    // Hapus item lama, pertahankan node empty-state
    listEl.querySelectorAll('.transaction-item').forEach(el => el.remove());

    if (transactions.length === 0) {
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';

    transactions.forEach(tx => {
        const color = CATEGORY_COLORS[tx.category] || '#a0aec0';
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
                <button class="btn-delete" data-id="${tx.id}" title="Hapus" aria-label="Hapus ${escapeHtml(tx.name)}">🗑️</button>
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

    // Kelompokkan total per kategori
    const totals = {};
    transactions.forEach(tx => {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
    });

    chart.data.labels = Object.keys(totals);
    chart.data.datasets[0].data = Object.values(totals);
    chart.data.datasets[0].backgroundColor = Object.keys(totals).map(c => CATEGORY_COLORS[c] || '#a0aec0');
    chart.update();
}

// ── Form Submission ────────────────────────────────────────────────────
document.getElementById('transaction-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const nameEl = document.getElementById('input-name');
    const amountEl = document.getElementById('input-amount');
    const categoryEl = document.getElementById('input-category');

    let valid = true;

    if (!nameEl.value.trim()) {
        setError(nameEl, 'err-name', true);
        valid = false;
    } else {
        setError(nameEl, 'err-name', false);
    }

    const amt = parseFloat(amountEl.value);
    if (!amountEl.value || isNaN(amt) || amt <= 0) {
        setError(amountEl, 'err-amount', true);
        valid = false;
    } else {
        setError(amountEl, 'err-amount', false);
    }

    if (!categoryEl.value) {
        setError(categoryEl, 'err-category', true);
        valid = false;
    } else {
        setError(categoryEl, 'err-category', false);
    }

    if (!valid) return;

    transactions.push({
        id: nextId++,
        name: nameEl.value.trim(),
        amount: amt,
        category: categoryEl.value,
    });

    saveToStorage();
    render();
    this.reset();
});

// ── Delete ─────────────────────────────────────────────────────────────
document.getElementById('transaction-list').addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;

    const id = parseInt(btn.dataset.id);
    transactions = transactions.filter(tx => tx.id !== id);
    saveToStorage();
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

// Hapus error saat user mulai mengetik / memilih
['input-name', 'input-amount', 'input-category'].forEach(id => {
    const el = document.getElementById(id);
    const evt = id === 'input-category' ? 'change' : 'input';
    el.addEventListener(evt, () => el.classList.remove('error'));
});

// ── Init ───────────────────────────────────────────────────────────────
render();

// ==========================================
// STATE MANAGEMENT & CONFIGURATION
// ==========================================

let state = {
    transactions: [],
    accounts: [],
    categories: {
        expense: ['Food & Groceries', 'Rent & Bills', 'Travel', 'Shopping & Entertainment', 'Others'],
        income: ['Salary', 'Business & Gigs', 'Others']
    },
    currency: '₹'
};

const categoryColors = {
    'Food & Groceries': '#F59E0B',          // Amber
    'Rent & Bills': '#3B82F6',              // Blue
    'Travel': '#8B5CF6',                    // Violet
    'Shopping & Entertainment': '#EC4899',   // Pink
    'Others': '#64748B',                    // Slate
    'Salary': '#10B981',                    // Emerald
    'Business & Gigs': '#34D399',            // Mint
    'Transfer': '#6366F1'                   // Indigo for transfers
};

// ==========================================
// TOAST NOTIFICATIONS SYSTEM
// ==========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`[Toast ${type}]: ${message}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ==========================================
// CENTRALIZED REST API GATEWAY
// ==========================================

async function apiCall(path, method = 'GET', body = null) {
    const token = localStorage.getItem('finflow_token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    // Resolve Backend Server URL (defaults to production API domain)
    let apiBase = 'https://api.businessbox.in';
    
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.');
    
    if (isLocal) {
        if (window.location.port && window.location.port !== '5500') { // Check if served by local backend server
            apiBase = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
        } else {
            apiBase = 'http://localhost:8080';
        }
    }
    
    // Explicit client override via local storage configuration
    const savedUrl = localStorage.getItem('finflow_api_url');
    if (savedUrl) {
        apiBase = savedUrl;
    }
    
    if (apiBase.endsWith('/')) {
        apiBase = apiBase.slice(0, -1);
    }
    
    const url = `${apiBase}${path}`;
    
    try {
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 403) {
            logoutUser();
            throw new Error('Session expired. Please login again.');
        }
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.error(`API Call failed (${url}):`, e);
        throw e;
    }
}

// Background poll & cache sync
async function syncStateFromServer() {
    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge && syncBadge.className !== 'badge-sync syncing') {
        syncBadge.className = 'badge-sync syncing';
        syncBadge.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...';
    }
    
    try {
        const [accounts, transactions, categories] = await Promise.all([
            apiCall('/api/accounts'),
            apiCall('/api/transactions'),
            apiCall('/api/categories')
        ]);
        
        state.accounts = accounts;
        state.transactions = transactions;
        state.categories = categories;
        
        // Cache locally for offline preview fallback
        localStorage.setItem('finflow_cached_state', JSON.stringify(state));
        
        if (syncBadge) {
            syncBadge.className = 'badge-sync synced';
            syncBadge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Connected';
        }
        
        // Refresh UI
        updateAccountDropdowns();
        updateCategoryOptions();
        renderAll();
    } catch (e) {
        console.error('Error syncing state:', e);
        if (syncBadge) {
            syncBadge.className = 'badge-sync error';
            syncBadge.innerHTML = '<i class="fa-solid fa-cloud-slash"></i> Sync Error';
        }
        
        // Fallback to cache
        const cached = localStorage.getItem('finflow_cached_state');
        if (cached) {
            try {
                const cachedState = JSON.parse(cached);
                state.accounts = cachedState.accounts || [];
                state.transactions = cachedState.transactions || [];
                state.categories = cachedState.categories || state.categories;
                
                updateAccountDropdowns();
                updateCategoryOptions();
                renderAll();
            } catch (err) {
                console.error('Error parsing cached state:', err);
            }
        }
    }
}

// Helper: Get Account Name by ID
function getAccountName(id) {
    if (!id) return '';
    const acc = state.accounts.find(a => a.id === id);
    return acc ? acc.name : '';
}

// ==========================================
// DYNAMIC BALANCE LEDGER CALCULATOR
// ==========================================
function calculateAccountBalances(upToDateStr) {
    let limitDate = null;
    if (upToDateStr) {
        const [yr, mo, dy] = upToDateStr.split('-').map(Number);
        limitDate = new Date(yr, mo - 1, dy, 23, 59, 59);
    }
    
    const balances = {};
    state.accounts.forEach(acc => {
        balances[acc.id] = acc.initial_balance || 0;
    });
    
    state.transactions.forEach(tx => {
        if (limitDate) {
            const txDate = new Date(tx.date);
            if (isNaN(txDate) || txDate > limitDate) {
                return; // Skip transactions after month boundary
            }
        }
        
        if (tx.type === 'income') {
            if (balances[tx.to_account] !== undefined) {
                balances[tx.to_account] += tx.amount;
            }
        } else if (tx.type === 'expense') {
            if (balances[tx.from_account] !== undefined) {
                balances[tx.from_account] -= tx.amount;
            }
        } else if (tx.type === 'transfer') {
            if (balances[tx.from_account] !== undefined) {
                balances[tx.from_account] -= tx.amount;
            }
            if (balances[tx.to_account] !== undefined) {
                balances[tx.to_account] += tx.amount;
            }
        }
    });
    
    return balances;
}

// ==========================================
// DYNAMIC MONTH DROP-DOWN BUILDER
// ==========================================
function populateMonthSelector() {
    const selector = document.getElementById('reportMonthSelect');
    if (!selector) return;

    const uniqueMonths = new Set();
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    uniqueMonths.add(currentMonthKey);

    state.transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(key);
        }
    });

    const prevSelected = selector.value || currentMonthKey;
    const sortedMonths = Array.from(uniqueMonths).sort().reverse();
    const monthsName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    selector.innerHTML = '';
    sortedMonths.forEach(key => {
        const [year, monthNumStr] = key.split('-');
        const monthIndex = parseInt(monthNumStr, 10) - 1;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${monthsName[monthIndex]} ${year}`;
        selector.appendChild(opt);
    });

    if (sortedMonths.includes(prevSelected)) {
        selector.value = prevSelected;
    } else {
        selector.value = currentMonthKey;
    }
}

// ==========================================
// RENDER KPI & GRAPH LOGS
// ==========================================
let categoryChartInstance = null;

function renderAll() {
    // Populate month select first
    populateMonthSelector();

    // Get current target month
    const today = new Date();
    let thisYear = today.getFullYear();
    let thisMonth = today.getMonth(); // 0-indexed

    const monthSelect = document.getElementById('reportMonthSelect');
    if (monthSelect && monthSelect.value) {
        const parts = monthSelect.value.split('-');
        if (parts.length === 2) {
            thisYear = parseInt(parts[0], 10);
            thisMonth = parseInt(parts[1], 10) - 1;
        }
    }

    // Accumulate target stats
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const categorySums = {};

    // Filter transactions
    const monthlyTransactions = state.transactions.filter(tx => {
        const d = new Date(tx.date);
        if (isNaN(d)) return false;
        
        const isTargetMonth = d.getFullYear() === thisYear && d.getMonth() === thisMonth;
        if (isTargetMonth) {
            if (tx.type === 'income') {
                monthlyIncome += tx.amount;
            } else if (tx.type === 'expense') {
                monthlyExpenses += tx.amount;
                categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.amount;
            }
        }
        return isTargetMonth;
    });

    // Net Savings
    const netSavings = monthlyIncome - monthlyExpenses;
    let savingsRate = 0;
    if (monthlyIncome > 0) {
        savingsRate = Math.round((netSavings / monthlyIncome) * 100);
    }

    // Format money helper
    const fmt = (val) => '₹' + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Update KPI UI
    document.getElementById('lblTotalIncome').textContent = fmt(monthlyIncome);
    document.getElementById('lblTotalExpenses').textContent = fmt(monthlyExpenses);
    
    const savingsEl = document.getElementById('lblTotalSavings');
    savingsEl.textContent = fmt(netSavings);
    if (netSavings < 0) {
        savingsEl.style.color = '#F43F5E'; // Red alert for negative
    } else {
        savingsEl.style.color = '#14B8A6'; // Teal 500 for positive
    }

    document.getElementById('lblSavingsPct').textContent = `${savingsRate < 0 ? 0 : savingsRate}% saved from earnings`;

    // Calculate balances up to the end of the selected month
    const lastDay = new Date(thisYear, thisMonth + 1, 0).getDate();
    const monthEndBoundaryStr = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const monthlyBalances = calculateAccountBalances(monthEndBoundaryStr);
    
    // Render account balances list widget
    renderAccountsWidget(monthlyBalances, fmt);

    // Render list of transactions
    renderTransactionsList(monthlyTransactions, fmt);

    // Draw chart
    renderDoughnutChart(categorySums);

    // AI Advice Generator
    renderAdvisorStrategy(monthlyIncome, monthlyExpenses, savingsRate, categorySums, fmt);

    // Month-by-Month Savings Report Table
    renderMonthlyReportTable();
}

function renderAccountsWidget(balances, formatFn) {
    const listContainer = document.getElementById('accountsList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    state.accounts.forEach(acc => {
        const bal = balances[acc.id] || 0;
        const item = document.createElement('div');
        item.className = 'account-item';
        
        let typeLabel = 'Bank Account';
        if (acc.type === 'savings') typeLabel = 'Savings Account';
        if (acc.type === 'cash') typeLabel = 'Cash Hand';
        
        item.innerHTML = `
            <div class="account-name-group">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="account-name">${escapeHtml(acc.name)}</span>
                    <button class="btn-delete-acc" onclick="deleteAccount('${acc.id}')" title="Delete Account">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <span class="account-type-badge">${typeLabel} • ${escapeHtml(acc.owner || 'Self')}</span>
            </div>
            <div class="account-balance">${formatFn(bal)}</div>
        `;
        listContainer.appendChild(item);
    });
}

function renderMonthlyReportTable() {
    const tableBody = document.getElementById('monthlyReportTableBody');
    if (!tableBody) return;

    // Get all unique months YYYY-MM present in transactions
    const uniqueMonths = new Set();
    state.transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(key);
        }
    });

    // Also include current month
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    uniqueMonths.add(currentMonthKey);

    const sortedMonths = Array.from(uniqueMonths).sort().reverse();
    const monthsName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    tableBody.innerHTML = '';
    
    const fmt = (val) => '₹' + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    sortedMonths.forEach(key => {
        const [yearStr, monthNumStr] = key.split('-');
        const targetYear = parseInt(yearStr, 10);
        const targetMonth = parseInt(monthNumStr, 10) - 1;

        let income = 0;
        let expenses = 0;

        state.transactions.forEach(tx => {
            const d = new Date(tx.date);
            if (!isNaN(d) && d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
                if (tx.type === 'income') {
                    income += tx.amount;
                } else if (tx.type === 'expense') {
                    expenses += tx.amount;
                }
            }
        });

        const netSavings = income - expenses;
        let rate = 0;
        if (income > 0) {
            rate = Math.round((netSavings / income) * 100);
        }

        const row = document.createElement('tr');
        const savingsColor = netSavings < 0 ? '#F43F5E' : '#14B8A6';
        const rateDisplay = rate < 0 ? '0%' : `${rate}%`;

        row.innerHTML = `
            <td style="font-weight: 700; padding: 0.85rem 1rem;">${monthsName[targetMonth]} ${targetYear}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: #10B981; font-weight: 600;">+${fmt(income)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: var(--text-primary);">-${fmt(expenses)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: ${savingsColor}; font-weight: 700;">${fmt(netSavings)}</td>
            <td style="text-align: center; padding: 0.85rem 1rem; font-weight: 700; color: ${savingsColor};">${rateDisplay}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Render list of logs
function renderTransactionsList(transactions, formatFn) {
    const listContainer = document.getElementById('simpleLogsList');
    const emptyState = document.getElementById('emptyState');

    if (!listContainer) return;

    if (transactions.length === 0) {
        listContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    listContainer.innerHTML = '';

    // Sort: Newest logs at the top
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'log-item';

        const dateObj = new Date(tx.date);
        const dateStr = isNaN(dateObj) ? tx.date : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        const typeSign = tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '⇄ ');
        const amountClass = tx.type === 'income' ? 'plus' : (tx.type === 'expense' ? 'minus' : 'transfer');

        let accountFlowText = '';
        if (tx.type === 'income') {
            accountFlowText = `to ${getAccountName(tx.to_account)}`;
        } else if (tx.type === 'expense') {
            accountFlowText = `from ${getAccountName(tx.from_account)}`;
        } else if (tx.type === 'transfer') {
            accountFlowText = `${getAccountName(tx.from_account)} → ${getAccountName(tx.to_account)}`;
        }

        item.innerHTML = `
            <div class="log-info-group">
                <span class="log-title">${escapeHtml(tx.description)}</span>
                <div class="log-subdetails">
                    <span class="category-tag">${tx.category}</span>
                    <span class="account-flow-tag" style="font-weight: 600; color: var(--text-secondary);">${accountFlowText}</span>
                    <span>${dateStr}</span>
                </div>
            </div>
            <div class="log-value-group">
                <span class="log-amount ${amountClass}">${typeSign}${formatFn(tx.amount)}</span>
                <button class="btn-delete-log" onclick="deleteLog('${tx.id}')" title="Delete Log">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Delete transaction
window.deleteLog = async function(id) {
    if (confirm('Are you sure you want to delete this transaction entry?')) {
        try {
            await apiCall(`/api/transactions/${id}`, 'DELETE');
            await syncStateFromServer();
        } catch (e) {
            alert('Error deleting transaction: ' + e.message);
        }
    }
};

// Draw Spending Chart
function renderDoughnutChart(categorySums) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const labels = Object.keys(categorySums);
    const data = Object.values(categorySums);
    const bgColors = labels.map(l => categoryColors[l] || '#64748B');

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    if (labels.length === 0) {
        // Render dummy chart for empty state
        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No expense logged'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#E2E8F0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    } else {
        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: bgColors,
                    borderWidth: 1,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#475569',
                            boxWidth: 10,
                            font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ₹${context.parsed.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

// Simple AI Advice
function renderAdvisorStrategy(income, expenses, rate, categorySums, fmt) {
    const container = document.getElementById('simpleAdvisorText');
    if (!container) return;

    if (income === 0 && expenses === 0) {
        container.innerHTML = '<strong>No transaction logged yet.</strong> Add transactions to see savings strategies.';
        return;
    }

    let tips = '';

    // Rule 1: Deficit checks
    if (income > 0 && expenses > income) {
        tips += `<span style="color: #F43F5E; font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> Alert: Spending Exceeds Income:</span><br>You spent ₹${(expenses - income).toLocaleString('en-IN')} more than you earned this month. Freeze unnecessary spending.<br><br>`;
    } else if (rate < 15 && income > 0) {
        tips += `<span style="color: #D97706; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Increase Savings:</span><br>Your savings rate is only ${rate}%. Aim for at least 20% to build a financial cushion.<br><br>`;
    } else if (rate >= 20) {
        tips += `<span style="color: #10B981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Great Savings Rate:</span><br>You saved ${rate}% of your earnings this month. Consider investing the surplus.<br><br>`;
    }

    // Rule 2: Top leaks
    let maxExpenseCategory = '';
    let maxExpenseVal = 0;
    Object.keys(categorySums).forEach(cat => {
        if (categorySums[cat] > maxExpenseVal) {
            maxExpenseVal = categorySums[cat];
            maxExpenseCategory = cat;
        }
    });

    if (maxExpenseCategory) {
        const pct = income > 0 ? ((maxExpenseVal / income) * 100).toFixed(0) : 0;
        tips += `<strong><i class="fa-solid fa-tags"></i> Top Outflow Category:</strong><br>Your highest spending was in <strong>${maxExpenseCategory}</strong> (₹${maxExpenseVal.toLocaleString('en-IN')}, which is ${pct}% of your inflow).`;
    }

    container.innerHTML = tips;
}

// ==========================================
// FORM CONTROLLERS & ACCOUNT SELECTORS
// ==========================================
const logCategorySelect = document.getElementById('logCategory');

function updateCategoryOptions() {
    if (!logCategorySelect) return;
    const type = document.getElementById('logType').value;
    const list = state.categories[type] || [];
    
    logCategorySelect.innerHTML = '';
    list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        logCategorySelect.appendChild(opt);
    });
}

function updateAccountDropdowns() {
    const fromSelect = document.getElementById('logFromAccount');
    const toSelect = document.getElementById('logToAccount');
    
    if (!fromSelect || !toSelect) return;
    
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    state.accounts.forEach(acc => {
        const nameWithOwner = `${acc.name} (${acc.owner || 'Self'})`;
        const opt1 = document.createElement('option');
        opt1.value = acc.id;
        opt1.textContent = nameWithOwner;
        fromSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = acc.id;
        opt2.textContent = nameWithOwner;
        toSelect.appendChild(opt2);
    });
}

// 3-way Form Type Toggle Handler
window.setFormType = function(type) {
    document.getElementById('logType').value = type;
    
    document.querySelectorAll('.type-toggle-group .btn-toggle').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const fromGroup = document.getElementById('groupFromAccount');
    const toGroup = document.getElementById('groupToAccount');
    const catGroup = document.getElementById('groupCategory');
    
    if (type === 'expense') {
        const btnToggleExpense = document.getElementById('btnToggleExpense');
        if (btnToggleExpense) btnToggleExpense.classList.add('active');
        if (fromGroup) fromGroup.style.display = 'block';
        if (toGroup) toGroup.style.display = 'none';
        if (catGroup) catGroup.style.display = 'block';
        updateCategoryOptions();
    } else if (type === 'income') {
        const btnToggleIncome = document.getElementById('btnToggleIncome');
        if (btnToggleIncome) btnToggleIncome.classList.add('active');
        if (fromGroup) fromGroup.style.display = 'none';
        if (toGroup) toGroup.style.display = 'block';
        if (catGroup) catGroup.style.display = 'block';
        updateCategoryOptions();
    } else if (type === 'transfer') {
        const btnToggleTransfer = document.getElementById('btnToggleTransfer');
        if (btnToggleTransfer) btnToggleTransfer.classList.add('active');
        if (fromGroup) fromGroup.style.display = 'block';
        if (toGroup) toGroup.style.display = 'block';
        if (catGroup) catGroup.style.display = 'none';
    }
};

window.triggerTransfer = function() {
    showPage('add-log');
    setFormType('transfer');
};

// ==========================================
// DYNAMIC ACCOUNT CREATION & DELETION DIALOGS
// ==========================================
window.openAddAccountModal = function() {
    const modal = document.getElementById('modal-add-account');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newAccName').value = '';
        document.getElementById('newAccOwner').value = '';
        document.getElementById('newAccBalance').value = '0';
        document.getElementById('newAccType').value = 'bank';
    }
};

window.closeAddAccountModal = function() {
    const modal = document.getElementById('modal-add-account');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.deleteAccount = async function(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;
    
    if (confirm(`Are you sure you want to delete the account "${acc.name}"? All associated transactions will also be permanently deleted!`)) {
        try {
            await apiCall(`/api/accounts/${accId}`, 'DELETE');
            await syncStateFromServer();
        } catch (e) {
            alert('Error deleting account: ' + e.message);
        }
    }
};

// Form listener for new account addition
const addAccountForm = document.getElementById('addAccountForm');
if (addAccountForm) {
    addAccountForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('newAccName').value.trim();
        const owner = document.getElementById('newAccOwner').value.trim();
        const initialBalance = parseFloat(document.getElementById('newAccBalance').value);
        const type = document.getElementById('newAccType').value;
        
        if (!name || !owner || isNaN(initialBalance) || initialBalance < 0 || !type) {
            alert('Please fill out all fields correctly!');
            return;
        }
        
        const newAccount = {
            name,
            owner,
            initialBalance,
            type
        };
        
        try {
            await apiCall('/api/accounts', 'POST', newAccount);
            await syncStateFromServer();
            closeAddAccountModal();
        } catch (e) {
            alert('Failed to create account: ' + e.message);
        }
    });
}

// ==========================================
// DYNAMIC CATEGORY CREATION DIALOGS
// ==========================================
window.openAddCategoryModal = function() {
    const modal = document.getElementById('modal-add-category');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newCatName').value = '';
        document.getElementById('newCatType').value = document.getElementById('logType').value === 'income' ? 'income' : 'expense';
    }
};

window.closeAddCategoryModal = function() {
    const modal = document.getElementById('modal-add-category');
    if (modal) {
        modal.style.display = 'none';
    }
};

const addCategoryForm = document.getElementById('addCategoryForm');
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('newCatName').value.trim();
        const type = document.getElementById('newCatType').value;
        
        if (!name || !type) {
            alert('Please enter a valid category name!');
            return;
        }
        
        try {
            const addedCat = await apiCall('/api/categories', 'POST', { name, type });
            await syncStateFromServer();
            
            // Select newly created category
            const logCategory = document.getElementById('logCategory');
            if (logCategory) {
                logCategory.value = addedCat.name;
            }
            
            closeAddCategoryModal();
        } catch (e) {
            alert('Failed to create category: ' + e.message);
        }
    });
}

// Form submit handler for new transaction
const form = document.getElementById('simpleLogForm');
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const type = document.getElementById('logType').value;
        const amount = parseFloat(document.getElementById('logAmount').value);
        const description = document.getElementById('logDesc').value.trim();
        const date = document.getElementById('logDate').value;

        let fromAccount = '';
        let toAccount = '';
        let category = 'Transfer';

        if (type === 'expense') {
            fromAccount = document.getElementById('logFromAccount').value;
            category = document.getElementById('logCategory').value;
            if (!fromAccount) { alert('Please select a Source Account!'); return; }
        } else if (type === 'income') {
            toAccount = document.getElementById('logToAccount').value;
            category = document.getElementById('logCategory').value;
            if (!toAccount) { alert('Please select a Target Account!'); return; }
        } else if (type === 'transfer') {
            fromAccount = document.getElementById('logFromAccount').value;
            toAccount = document.getElementById('logToAccount').value;
            if (!fromAccount || !toAccount) { alert('Please select both Accounts for Transfer!'); return; }
            if (fromAccount === toAccount) { alert('Source and Destination Accounts cannot be the same!'); return; }
        }

        if (isNaN(amount) || amount <= 0 || !description || !date) {
            alert('Please fill out all fields correctly!');
            return;
        }

        const newLog = {
            description,
            amount,
            type,
            category,
            date,
            fromAccount,
            toAccount
        };

        try {
            await apiCall('/api/transactions', 'POST', newLog);
            await syncStateFromServer();
            
            // Reset form inputs
            document.getElementById('logAmount').value = '';
            document.getElementById('logDesc').value = '';

            // Navigate back to dashboard
            showPage('dashboard');
        } catch (e) {
            alert('Failed to record transaction: ' + e.message);
        }
    });
}

// ==========================================
// CONTROL UTILITIES
// ==========================================

// ==========================================
// CONTROL UTILITIES & BACKUPS
// ==========================================

// Load demo mock data
document.getElementById('btnLoadDemo').addEventListener('click', async function() {
    if (confirm('Load demo data? This will overwrite your current logs.')) {
        try {
            showToast('Loading example logs...', 'info');
            await apiCall('/api/demo', 'POST');
            await syncStateFromServer();
            showToast('Demo mock data loaded successfully!', 'success');
        } catch (e) {
            showToast('Failed to load demo data: ' + e.message, 'error');
        }
    }
});

// Reset app
document.getElementById('btnResetAll').addEventListener('click', async function() {
    if (confirm('Are you sure you want to delete all logs and reset the app?')) {
        try {
            showToast('Deleting all data...', 'info');
            await apiCall('/api/reset', 'POST');
            await syncStateFromServer();
            showToast('All user data reset successfully.', 'success');
        } catch (e) {
            showToast('Failed to reset app: ' + e.message, 'error');
        }
    }
});

// JSON Backup Export
const btnExportJSON = document.getElementById('btnExportJSON');
if (btnExportJSON) {
    btnExportJSON.addEventListener('click', async function() {
        try {
            showToast('Generating backup file...', 'info');
            const data = await apiCall('/api/backup/export');
            
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `finflow_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('JSON backup file downloaded successfully!', 'success');
        } catch (e) {
            showToast('Failed to export backup: ' + e.message, 'error');
        }
    });
}

// JSON Backup Import trigger
window.triggerImportClick = function() {
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) fileInput.click();
};

// JSON Backup Import file loader
window.handleImportFile = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            showToast('Parsing backup file...', 'info');
            const data = JSON.parse(e.target.result);
            
            if (!data.accounts || !data.transactions) {
                throw new Error('Invalid backup file. Accounts and transactions properties must exist.');
            }
            
            if (confirm('Importing data will overwrite all your current accounts and transactions. Proceed?')) {
                showToast('Importing database logs...', 'info');
                await apiCall('/api/backup/import', 'POST', data);
                showToast('Backup restored successfully!', 'success');
                await syncStateFromServer();
            }
        } catch (err) {
            showToast('Failed to import backup: ' + err.message, 'error');
        }
        // Reset file input value to allow uploading the same file again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
};

// Excel backup CSV export
document.getElementById('btnExportCSV').addEventListener('click', function() {
    if (state.transactions.length === 0) {
        showToast('There are no transactions to export.', 'error');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Description,Type,Category,Amount (INR),From Account,To Account\n";

    state.transactions.forEach(t => {
        const desc = t.description.replace(/,/g, ' ');
        const fromName = getAccountName(t.from_account);
        const toName = getAccountName(t.to_account);
        csvContent += `${t.date},${desc},${t.type},${t.category},${t.amount},${fromName},${toName}\n`;
    });

    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `hisab_kitab_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel CSV exported successfully!', 'success');
});

// Month selector change listener
const monthSelect = document.getElementById('reportMonthSelect');
if (monthSelect) {
    monthSelect.addEventListener('change', renderAll);
}

// ==========================================
// NAVIGATION & PAGE VIEW SWITCHER
// ==========================================
window.showPage = function(pageId) {
    document.querySelectorAll('.page-view').forEach(p => {
        p.style.display = 'none';
    });
    const target = document.getElementById('page-' + pageId);
    if (target) {
        if (pageId === 'lock') {
            target.style.display = 'flex';
        } else {
            target.style.display = 'block';
        }
    }
    window.scrollTo(0, 0);

    // Re-render dashboard components if switching to dashboard so Chart.js has correct dimensions
    if (pageId === 'dashboard') {
        renderAll();
    }
};

// ==========================================
// SECURITY LOGIN & REGISTRATION LOCK SCREEN
// ==========================================
let authMode = 'login'; // 'login' or 'register'

window.toggleAuthMode = function() {
    authMode = authMode === 'login' ? 'register' : 'login';
    const lockTitle = document.getElementById('lockTitle');
    const lockSubtitle = document.getElementById('lockSubtitle');
    const authToggleLabel = document.getElementById('authToggleLabel');
    const authToggleLink = document.getElementById('authToggleLink');
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    
    if (authMode === 'login') {
        if (lockTitle) lockTitle.textContent = 'Login to FinFlow';
        if (lockSubtitle) lockSubtitle.textContent = 'Enter your credentials to access your logs';
        if (authToggleLabel) authToggleLabel.textContent = 'New user?';
        if (authToggleLink) authToggleLink.textContent = 'Create Account';
        if (btnAuthSubmit) btnAuthSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
    } else {
        if (lockTitle) lockTitle.textContent = 'Register Account';
        if (lockSubtitle) lockSubtitle.textContent = 'Choose a username and password (min 6 characters)';
        if (authToggleLabel) authToggleLabel.textContent = 'Already have an account?';
        if (authToggleLink) authToggleLink.textContent = 'Login';
        if (btnAuthSubmit) btnAuthSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i> Register';
    }
    
    const pwField = document.getElementById('authPassword');
    if (pwField) pwField.value = '';
    const footerMsg = document.getElementById('lockFooterMessage');
    if (footerMsg) footerMsg.textContent = '';
};

function setupLockScreenState() {
    const token = localStorage.getItem('finflow_token');
    const username = localStorage.getItem('finflow_username');

    const isStaticHost = window.location.hostname.endsWith('github.io');
    const warningDiv = document.getElementById('staticHostWarning');
    if (warningDiv) {
        if (isStaticHost) {
            warningDiv.style.display = 'block';
            const savedUrl = localStorage.getItem('finflow_api_url') || '';
            document.getElementById('authBackendUrl').value = savedUrl;
        } else {
            warningDiv.style.display = 'none';
        }
    }

    if (!token) {
        authMode = 'login';
        const lockTitle = document.getElementById('lockTitle');
        const lockSubtitle = document.getElementById('lockSubtitle');
        const authToggleLabel = document.getElementById('authToggleLabel');
        const authToggleLink = document.getElementById('authToggleLink');
        const btnAuthSubmit = document.getElementById('btnAuthSubmit');
        
        if (lockTitle) lockTitle.textContent = 'Login to FinFlow';
        if (lockSubtitle) lockSubtitle.textContent = 'Enter your credentials to access your logs';
        if (authToggleLabel) authToggleLabel.textContent = 'New user?';
        if (authToggleLink) authToggleLink.textContent = 'Create Account';
        if (btnAuthSubmit) btnAuthSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
        
        document.getElementById('authUsername').value = '';
        const pwField = document.getElementById('authPassword');
        if (pwField) pwField.value = '';
        showPage('lock');
    } else {
        document.getElementById('lblUserDisplay').textContent = username || 'User';
        showPage('dashboard');
        syncStateFromServer();
    }
}

async function handleAuthSubmit() {
    const usernameInput = document.getElementById('authUsername');
    const passwordInput = document.getElementById('authPassword');
    const footerMsg = document.getElementById('lockFooterMessage');
    
    if (!usernameInput || !usernameInput.value.trim() || !passwordInput || !passwordInput.value) {
        if (footerMsg) {
            footerMsg.textContent = 'Username and password are required!';
            footerMsg.style.color = 'var(--danger)';
        }
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (authMode === 'register' && password.length < 6) {
        if (footerMsg) {
            footerMsg.textContent = 'Password must be at least 6 characters!';
            footerMsg.style.color = 'var(--danger)';
        }
        return;
    }
    
    // Save backend server URL if on static host
    if (window.location.hostname.endsWith('github.io')) {
        const backendUrlInput = document.getElementById('authBackendUrl');
        if (backendUrlInput) {
            let backendUrl = backendUrlInput.value.trim();
            if (!backendUrl) {
                if (footerMsg) {
                    footerMsg.textContent = 'Please enter your backend URL!';
                    footerMsg.style.color = 'var(--danger)';
                }
                return;
            }
            // Add https:// protocol if missing
            if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
                backendUrl = 'https://' + backendUrl;
            }
            localStorage.setItem('finflow_api_url', backendUrl);
        }
    }
    
    if (footerMsg) {
        footerMsg.textContent = authMode === 'login' ? 'Logging in...' : 'Registering...';
        footerMsg.style.color = 'var(--text-secondary)';
    }
    
    try {
        const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const data = await apiCall(path, 'POST', { username, password });
        
        // Save auth data
        localStorage.setItem('finflow_token', data.token);
        localStorage.setItem('finflow_username', data.user.username);
        localStorage.setItem('finflow_user_id', data.user.id);
        
        // Setup User display
        document.getElementById('lblUserDisplay').textContent = data.user.username;
        
        if (footerMsg) footerMsg.textContent = '';
        passwordInput.value = '';
        
        // Sync & render
        await syncStateFromServer();
        showPage('dashboard');
        showToast(authMode === 'login' ? 'Logged in successfully!' : 'Registered successfully!', 'success');
    } catch (e) {
        if (footerMsg) {
            footerMsg.textContent = e.message || 'Authentication failed.';
            footerMsg.style.color = 'var(--danger)';
        }
    }
}

window.logoutUser = function() {
    localStorage.removeItem('finflow_token');
    localStorage.removeItem('finflow_username');
    localStorage.removeItem('finflow_user_id');
    localStorage.removeItem('finflow_cached_state');
    
    state.transactions = [];
    state.accounts = [];
    
    document.getElementById('lblUserDisplay').textContent = 'Guest';
    setupLockScreenState();
};

// ==========================================
// APP STARTUP INITIALIZATION
// ==========================================
function init() {
    // Check session login state
    setupLockScreenState();

    // Default logging date to Today
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.value = todayStr;
    }

    // Set form defaults
    setFormType('expense');

    // Bind login form submit
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAuthSubmit();
        });
    }

    // Auto sync state in background every 15 seconds if logged in
    setInterval(() => {
        if (localStorage.getItem('finflow_token')) {
            syncStateFromServer();
        }
    }, 15000);
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.addEventListener('DOMContentLoaded', init);

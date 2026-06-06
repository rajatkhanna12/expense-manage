// ==========================================
// STATE MANAGEMENT & ACCOUNTS INITIALIZATION
// ==========================================

let state = {
    transactions: [],
    accounts: [
        { id: 'acc-hdfc', name: 'HDFC Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
        { id: 'acc-sbi', name: 'SBI Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
        { id: 'acc-savings', name: 'Savings Account', owner: 'Rajat', initialBalance: 0, type: 'savings' },
        { id: 'acc-cash', name: 'Cash', owner: 'Rajat', initialBalance: 0, type: 'cash' }
    ],
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

const LOCAL_STORAGE_KEY = 'finflow_simple_state';

// ==========================================
// PRE-POPULATED EMPTY AND MOCK DATA TEMPLATES
// ==========================================
function getInitialEmptyState() {
    return {
        accounts: [
            { id: 'acc-hdfc', name: 'HDFC Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
            { id: 'acc-sbi', name: 'SBI Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
            { id: 'acc-savings', name: 'Savings Account', owner: 'Rajat', initialBalance: 0, type: 'savings' },
            { id: 'acc-cash', name: 'Cash', owner: 'Rajat', initialBalance: 0, type: 'cash' }
        ],
        transactions: [],
        categories: {
            expense: ['Food & Groceries', 'Rent & Bills', 'Travel', 'Shopping & Entertainment', 'Others'],
            income: ['Salary', 'Business & Gigs', 'Others']
        },
        currency: '₹'
    };
}

function getDemoMockData() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth(); // 0-indexed

    const formatRelativeDate = (monthOffset, day) => {
        let targetMonth = currentMonthNum + monthOffset;
        let targetYear = currentYear;
        if (targetMonth < 0) {
            targetMonth += 12;
            targetYear -= 1;
        } else if (targetMonth > 11) {
            targetMonth -= 12;
            targetYear += 1;
        }
        const m = String(targetMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${targetYear}-${m}-${d}`;
    };

    return {
        accounts: [
            { id: 'acc-hdfc', name: 'HDFC Bank', owner: 'Rajat', initialBalance: 25000, type: 'bank' },
            { id: 'acc-sbi', name: 'SBI Bank', owner: 'Rajat', initialBalance: 15000, type: 'bank' },
            { id: 'acc-savings', name: 'Savings Account', owner: 'Rajat', initialBalance: 50000, type: 'savings' },
            { id: 'acc-cash', name: 'Cash', owner: 'Rajat', initialBalance: 2000, type: 'cash' }
        ],
        categories: {
            expense: ['Food & Groceries', 'Rent & Bills', 'Travel', 'Shopping & Entertainment', 'Others'],
            income: ['Salary', 'Business & Gigs', 'Others']
        },
        transactions: [
            // Previous Month Income
            { id: 't1', description: 'Client A Project Payment', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(-1, 1), fromAccount: '', toAccount: 'acc-hdfc' },
            { id: 't2', description: 'Freelance Design Work', amount: 5500, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(-1, 15), fromAccount: '', toAccount: 'acc-sbi' },
            
            // Previous Month Expenses
            { id: 't3', description: 'Apartment Rent HDFC', amount: 12000, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(-1, 1), fromAccount: 'acc-hdfc', toAccount: '' },
            { id: 't4', description: 'Weekly Groceries Cash', amount: 2800, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 5), fromAccount: 'acc-cash', toAccount: '' },
            { id: 't5', description: 'Savings Allocation', amount: 15000, type: 'transfer', category: 'Transfer', date: formatRelativeDate(-1, 10), fromAccount: 'acc-hdfc', toAccount: 'acc-savings' },
            { id: 't6', description: 'Dining out with Friends', amount: 1600, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 14), fromAccount: 'acc-sbi', toAccount: '' },
            { id: 't7', description: 'Online Shopping HDFC', amount: 2500, type: 'expense', category: 'Shopping & Entertainment', date: formatRelativeDate(-1, 20), fromAccount: 'acc-hdfc', toAccount: '' },
            { id: 't8', description: 'Medicines purchase', amount: 800, type: 'expense', category: 'Others', date: formatRelativeDate(-1, 25), fromAccount: 'acc-cash', toAccount: '' },

            // Current Month Income
            { id: 't9', description: 'Corporate Job Salary', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(0, 1), fromAccount: '', toAccount: 'acc-hdfc' },
            { id: 't10', description: 'Consulting Contract Work', amount: 8000, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(0, 4), fromAccount: '', toAccount: 'acc-hdfc' },
            
            // Current Month Expenses
            { id: 't11', description: 'Apartment Rent HDFC', amount: 12500, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 1), fromAccount: 'acc-hdfc', toAccount: '' },
            { id: 't12', description: 'Weekly Groceries Restock', amount: 3100, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(0, 3), fromAccount: 'acc-sbi', toAccount: '' },
            { id: 't13', description: 'Savings Transfer', amount: 10000, type: 'transfer', category: 'Transfer', date: formatRelativeDate(0, 5), fromAccount: 'acc-hdfc', toAccount: 'acc-savings' },
            { id: 't14', description: 'Fuel Refill Tank', amount: 950, type: 'expense', category: 'Travel', date: formatRelativeDate(0, 5), fromAccount: 'acc-hdfc', toAccount: '' },
            { id: 't15', description: 'Mobile Recharge Plan', amount: 499, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 6), fromAccount: 'acc-sbi', toAccount: '' }
        ],
        currency: '₹'
    };
}

// Load State from storage
function loadState() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            state = JSON.parse(saved);
            state.currency = '₹'; // Guarantee INR symbol
            
            // Backward compatibility checks
            if (!state.accounts || state.accounts.length === 0) {
                state.accounts = [
                    { id: 'acc-hdfc', name: 'HDFC Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
                    { id: 'acc-sbi', name: 'SBI Bank', owner: 'Rajat', initialBalance: 0, type: 'bank' },
                    { id: 'acc-savings', name: 'Savings Account', owner: 'Rajat', initialBalance: 0, type: 'savings' },
                    { id: 'acc-cash', name: 'Cash', owner: 'Rajat', initialBalance: 0, type: 'cash' }
                ];
                saveState();
            } else {
                state.accounts.forEach(acc => {
                    if (!acc.owner) acc.owner = 'Rajat';
                });
                saveState();
            }
            
            if (!state.categories) {
                state.categories = {
                    expense: ['Food & Groceries', 'Rent & Bills', 'Travel', 'Shopping & Entertainment', 'Others'],
                    income: ['Salary', 'Business & Gigs', 'Others']
                };
                saveState();
            }
        } catch (e) {
            console.error('Error loading state:', e);
            state = getInitialEmptyState();
            saveState();
        }
    } else {
        state = getInitialEmptyState();
        saveState();
    }
}

// Save state
function saveState() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
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
        balances[acc.id] = acc.initialBalance || 0;
    });
    
    state.transactions.forEach(tx => {
        if (limitDate) {
            const txDate = new Date(tx.date);
            if (isNaN(txDate) || txDate > limitDate) {
                return; // Skip transactions after month boundary
            }
        }
        
        if (tx.type === 'income') {
            if (balances[tx.toAccount] !== undefined) {
                balances[tx.toAccount] += tx.amount;
            }
        } else if (tx.type === 'expense') {
            if (balances[tx.fromAccount] !== undefined) {
                balances[tx.fromAccount] -= tx.amount;
            }
        } else if (tx.type === 'transfer') {
            if (balances[tx.fromAccount] !== undefined) {
                balances[tx.fromAccount] -= tx.amount;
            }
            if (balances[tx.toAccount] !== undefined) {
                balances[tx.toAccount] += tx.amount;
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

    // Month-by-Month Savings Table Renderer
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
            accountFlowText = `to ${getAccountName(tx.toAccount)}`;
        } else if (tx.type === 'expense') {
            accountFlowText = `from ${getAccountName(tx.fromAccount)}`;
        } else if (tx.type === 'transfer') {
            accountFlowText = `${getAccountName(tx.fromAccount)} → ${getAccountName(tx.toAccount)}`;
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
window.deleteLog = function(id) {
    if (confirm('Are you sure you want to delete this transaction entry?')) {
        state.transactions = state.transactions.filter(tx => tx.id !== id);
        saveState();
        renderAll();
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

window.deleteAccount = function(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;
    
    if (confirm(`Are you sure you want to delete the account "${acc.name}"? All associated transactions will also be permanently deleted!`)) {
        // Delete the account
        state.accounts = state.accounts.filter(a => a.id !== accId);
        // Delete associated transactions
        state.transactions = state.transactions.filter(tx => tx.fromAccount !== accId && tx.toAccount !== accId);
        
        saveState();
        updateAccountDropdowns();
        renderAll();
    }
};

// Form listener for new account addition
const addAccountForm = document.getElementById('addAccountForm');
if (addAccountForm) {
    addAccountForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('newAccName').value.trim();
        const owner = document.getElementById('newAccOwner').value.trim();
        const initialBalance = parseFloat(document.getElementById('newAccBalance').value);
        const type = document.getElementById('newAccType').value;
        
        if (!name || !owner || isNaN(initialBalance) || initialBalance < 0 || !type) {
            alert('Please fill out all fields correctly!');
            return;
        }
        
        // Check duplicate names (scoped by owner for uniqueness)
        const exists = state.accounts.some(a => a.name.toLowerCase() === name.toLowerCase() && (a.owner || '').toLowerCase() === owner.toLowerCase());
        if (exists) {
            alert('An account with this name and owner already exists!');
            return;
        }
        
        const newAccount = {
            id: 'acc-' + Date.now(),
            name,
            owner,
            initialBalance,
            type
        };
        
        state.accounts.push(newAccount);
        saveState();
        
        // Refresh UI dropdown selectors and render balances
        updateAccountDropdowns();
        renderAll();
        
        // Close Modal
        closeAddAccountModal();
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
    addCategoryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('newCatName').value.trim();
        const type = document.getElementById('newCatType').value;
        
        if (!name || !type) {
            alert('Please enter a valid category name!');
            return;
        }
        
        // Check duplicates
        const exists = state.categories[type].some(c => c.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert('This category already exists!');
            return;
        }
        
        // Add to state
        state.categories[type].push(name);
        
        // Assign a random pastel color for charts
        const colors = ['#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#34D399', '#6366F1', '#06B6D4', '#F43F5E', '#14B8A6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        categoryColors[name] = randomColor;
        
        saveState();
        
        // Refresh form categories
        updateCategoryOptions();
        
        // Select newly created category
        const logCategory = document.getElementById('logCategory');
        if (logCategory) {
            logCategory.value = name;
        }
        
        // Close modal
        closeAddCategoryModal();
    });
}

// Form submit handler
const form = document.getElementById('simpleLogForm');
if (form) {
    form.addEventListener('submit', function(e) {
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
            id: 't-' + Date.now(),
            description,
            amount,
            type,
            category,
            date,
            fromAccount,
            toAccount
        };

        state.transactions.push(newLog);
        saveState();
        renderAll();

        // Reset form inputs
        document.getElementById('logAmount').value = '';
        document.getElementById('logDesc').value = '';

        // Navigate back to dashboard
        showPage('dashboard');
    });
}

// ==========================================
// CONTROL UTILITIES
// ==========================================

// Load demo mock data
document.getElementById('btnLoadDemo').addEventListener('click', function() {
    if (confirm('Load demo data? This will overwrite your current logs.')) {
        state = getDemoMockData();
        saveState();
        renderAll();
    }
});

// Reset app
document.getElementById('btnResetAll').addEventListener('click', function() {
    if (confirm('Are you sure you want to delete all logs and reset the app?')) {
        state = getInitialEmptyState();
        saveState();
        renderAll();
    }
});

// Excel backup CSV export
document.getElementById('btnExportCSV').addEventListener('click', function() {
    if (state.transactions.length === 0) {
        alert('There are no transactions to export.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Description,Type,Category,Amount (INR),From Account,To Account\n";

    state.transactions.forEach(t => {
        const desc = t.description.replace(/,/g, ' ');
        const fromName = getAccountName(t.fromAccount);
        const toName = getAccountName(t.toAccount);
        csvContent += `${t.date},${desc},${t.type},${t.category},${t.amount},${fromName},${toName}\n`;
    });

    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `hisab_kitab_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
// PASSCODE SECURITY LOCK SCREEN LOGIC
// ==========================================
let pinBuffer = '';
let isSettingPasscode = false;

function setupLockScreenState() {
    const savedPin = localStorage.getItem('finflow_passcode');
    const lockTitle = document.getElementById('lockTitle');
    const lockSubtitle = document.getElementById('lockSubtitle');

    if (!savedPin) {
        isSettingPasscode = true;
        if (lockTitle) lockTitle.textContent = 'Set a Passcode';
        if (lockSubtitle) lockSubtitle.textContent = 'Choose a 4-digit PIN to lock your reports';
        showPage('lock');
    } else {
        isSettingPasscode = false;
        if (lockTitle) lockTitle.textContent = 'Enter Passcode';
        if (lockSubtitle) lockSubtitle.textContent = 'Secure your financial logs';
        showPage('lock');
    }
    updatePinDots();
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, idx) => {
        if (idx < pinBuffer.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

window.pressPin = function(num) {
    if (pinBuffer.length >= 4) return;
    
    pinBuffer += num;
    updatePinDots();
    
    const footerMsg = document.getElementById('lockFooterMessage');
    if (footerMsg) footerMsg.textContent = '';

    if (pinBuffer.length === 4) {
        setTimeout(checkPinEntry, 200);
    }
};

window.clearPin = function() {
    pinBuffer = '';
    updatePinDots();
    const footerMsg = document.getElementById('lockFooterMessage');
    if (footerMsg) footerMsg.textContent = '';
};

window.deletePin = function() {
    if (pinBuffer.length > 0) {
        pinBuffer = pinBuffer.slice(0, -1);
        updatePinDots();
    }
    const footerMsg = document.getElementById('lockFooterMessage');
    if (footerMsg) footerMsg.textContent = '';
};

function checkPinEntry() {
    const footerMsg = document.getElementById('lockFooterMessage');

    if (isSettingPasscode) {
        localStorage.setItem('finflow_passcode', pinBuffer);
        alert('Passcode set successfully! Remember this passcode.');
        isSettingPasscode = false;
        pinBuffer = '';
        updatePinDots();
        showPage('dashboard');
    } else {
        const correctPin = localStorage.getItem('finflow_passcode');
        if (pinBuffer === correctPin) {
            pinBuffer = '';
            updatePinDots();
            showPage('dashboard');
        } else {
            if (footerMsg) footerMsg.textContent = 'Incorrect Passcode. Try Again!';
            pinBuffer = '';
            updatePinDots();
        }
    }
}

// ==========================================
// APP STARTUP INITIALIZATION
// ==========================================
function init() {
    // Load local storage
    loadState();

    // Check passcode setup
    setupLockScreenState();

    // Populate dropdown selectors with active bank accounts
    updateAccountDropdowns();

    // Set dynamic dropdown categories options based on default type selected
    setFormType('expense');

    // Default logging date to Today
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.value = todayStr;
    }

    // Bind selector and render first screen
    renderAll();
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

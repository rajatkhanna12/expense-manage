// ==========================================
// DASHBOARD CONTROLLER FOR MPA
// ==========================================

// Auth Guard Check first
checkAuth();

let categoryChartInstance = null;
let isSyncing = false;

// Dynamic Balance Ledger Calculator
function calculateAccountBalances(upToDateStr) {
    const balances = {};
    state.accounts.forEach(acc => {
        balances[acc.id] = acc.initial_balance || 0;
    });
    
    state.transactions.forEach(tx => {
        if (upToDateStr && tx.date) {
            // Lexicographical YYYY-MM-DD string comparison avoids timezone shift issues
            if (tx.date > upToDateStr) {
                return; // Skip transactions after date boundary
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

// Background sync from server
async function syncStateFromServer() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        const [accounts, transactions, categories] = await Promise.all([
            apiCall('/api/accounts'),
            apiCall('/api/transactions'),
            apiCall('/api/categories')
        ]);
        
        state.accounts = accounts;
        state.transactions = transactions;
        state.categories = categories;
        
        // Cache locally
        localStorage.setItem('finflow_cached_state', JSON.stringify(state));
        
        renderAll();
    } catch (e) {
        console.error('Error syncing state:', e);
        // Fallback to cache
        loadCachedState();
    } finally {
        isSyncing = false;
    }
}

function loadCachedState() {
    const cached = localStorage.getItem('finflow_cached_state');
    if (cached) {
        try {
            const cachedState = JSON.parse(cached);
            state.accounts = cachedState.accounts || [];
            state.transactions = cachedState.transactions || [];
            state.categories = cachedState.categories || state.categories;
            renderAll();
        } catch (err) {
            console.error('Error parsing cached state:', err);
        }
    }
}

// Dynamic Month Selector Builder
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
        const [yearStr, monthNumStr] = key.split('-');
        const targetMonth = parseInt(monthNumStr, 10) - 1;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${monthsName[targetMonth]} ${yearStr}`;
        selector.appendChild(opt);
    });

    selector.value = prevSelected;
}

// Render Dashboard
function renderAll() {
    populateMonthSelector();

    const today = new Date();
    let thisYear = today.getFullYear();
    let thisMonth = today.getMonth();

    const monthSelect = document.getElementById('reportMonthSelect');
    if (monthSelect && monthSelect.value) {
        const parts = monthSelect.value.split('-');
        if (parts.length === 2) {
            thisYear = parseInt(parts[0], 10);
            thisMonth = parseInt(parts[1], 10) - 1;
        }
    }

    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const categorySums = {};

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

    const netSavings = monthlyIncome - monthlyExpenses;
    let savingsRate = 0;
    if (monthlyIncome > 0) {
        savingsRate = Math.round((netSavings / monthlyIncome) * 100);
    }

    document.getElementById('lblTotalIncome').textContent = fmt(monthlyIncome);
    document.getElementById('lblTotalExpenses').textContent = fmt(monthlyExpenses);
    
    const savingsEl = document.getElementById('lblTotalSavings');
    savingsEl.textContent = fmt(netSavings);
    if (netSavings < 0) {
        savingsEl.style.color = '#F43F5E';
    } else {
        savingsEl.style.color = '#14B8A6';
    }

    document.getElementById('lblSavingsPct').textContent = `${savingsRate < 0 ? 0 : savingsRate}% saved from earnings`;

    // Balances up to the end of the selected month
    const lastDay = new Date(thisYear, thisMonth + 1, 0).getDate();
    const monthEndBoundaryStr = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const monthlyBalances = calculateAccountBalances(monthEndBoundaryStr);
    
    renderAccountsWidget(monthlyBalances);
    renderTransactionsList(monthlyTransactions);
    renderDoughnutChart(categorySums);
    renderAdvisorStrategy(monthlyIncome, monthlyExpenses, savingsRate, categorySums);
    renderMonthlyReportTable();
}

// Render Accounts
function renderAccountsWidget(balances) {
    const listContainer = document.getElementById('accountsList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    state.accounts.forEach(acc => {
        const bal = balances[acc.id] || 0;
        const item = document.createElement('div');
        item.className = 'account-item';
        item.setAttribute('onclick', `window.location.href = 'statement.html?account=${acc.id}'`);
        
        let typeLabel = 'Bank Account';
        if (acc.type === 'savings') typeLabel = 'Savings Account';
        if (acc.type === 'cash') typeLabel = 'Cash Hand';
        
        item.innerHTML = `
            <div class="account-name-group">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="account-name">${escapeHtml(acc.name)}</span>
                    <button class="btn-delete-acc" onclick="event.stopPropagation(); deleteAccount('${acc.id}')" title="Delete Account">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <span class="account-type-badge">${typeLabel} • ${escapeHtml(acc.owner || 'Self')}</span>
            </div>
            <div class="account-balance">${fmt(bal)}</div>
        `;
        listContainer.appendChild(item);
    });
}

// Delete account
window.deleteAccount = async function(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;
    
    if (confirm(`Are you sure you want to delete "${acc.name}"? All associated transactions will be permanently deleted.`)) {
        try {
            await apiCall(`/api/accounts/${accId}`, 'DELETE');
            await syncStateFromServer();
            showToast('Account deleted successfully.', 'success');
        } catch (e) {
            showToast('Error deleting account: ' + e.message, 'error');
        }
    }
};

// Render transactions logs
function renderTransactionsList(transactions) {
    const listContainer = document.getElementById('simpleLogsList');
    const emptyState = document.getElementById('emptyState');

    if (!listContainer) return;

    if (transactions.length === 0) {
        listContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        listContainer.innerHTML = '';

        // Sort newest transactions first
        const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'log-item';

            const dateObj = new Date(tx.date);
            const dateStr = isNaN(dateObj) ? tx.date : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

            let typeSign = '';
            let amountClass = '';
            let details = '';

            if (tx.type === 'income') {
                typeSign = '+';
                amountClass = 'plus';
                const accName = state.accounts.find(a => a.id === tx.to_account)?.name || 'Account';
                details = `Income to ${accName}`;
            } else if (tx.type === 'expense') {
                typeSign = '-';
                amountClass = 'minus';
                const accName = state.accounts.find(a => a.id === tx.from_account)?.name || 'Account';
                details = `Expense from ${accName}`;
            } else if (tx.type === 'transfer') {
                typeSign = '';
                amountClass = 'transfer';
                const fromAcc = state.accounts.find(a => a.id === tx.from_account)?.name || 'Source';
                const toAcc = state.accounts.find(a => a.id === tx.to_account)?.name || 'Destination';
                details = `Transfer ${fromAcc} → ${toAcc}`;
            }

            item.innerHTML = `
                <div class="log-info-group">
                    <span class="log-title">${escapeHtml(tx.description)}</span>
                    <div class="log-subdetails">
                        <span class="category-tag">${tx.category}</span>
                        <span style="font-weight: 600; color: var(--text-secondary);">${details}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="log-value-group">
                    <span class="log-amount ${amountClass}">${typeSign}${fmt(tx.amount)}</span>
                    <button class="btn-delete-log" onclick="deleteLog('${tx.id}')" title="Delete Log">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }
}

// Delete Log
window.deleteLog = async function(id) {
    if (confirm('Are you sure you want to delete this transaction entry?')) {
        try {
            await apiCall(`/api/transactions/${id}`, 'DELETE');
            await syncStateFromServer();
            showToast('Transaction deleted successfully.', 'success');
        } catch (e) {
            showToast('Error deleting transaction: ' + e.message, 'error');
        }
    }
};

// Render Doughnut Chart
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

// AI Advisor Tips
function renderAdvisorStrategy(income, expenses, rate, categorySums) {
    const container = document.getElementById('simpleAdvisorText');
    if (!container) return;

    if (income === 0 && expenses === 0) {
        container.innerHTML = '<strong>No transactions logged yet.</strong> Add transactions to see savings strategies.';
        return;
    }

    let tips = '';

    if (income > 0 && expenses > income) {
        tips += `<span style="color: #F43F5E; font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> Alert: Spending Exceeds Income:</span><br>You spent ₹${(expenses - income).toLocaleString('en-IN')} more than you earned this month. Freeze unnecessary spending.<br><br>`;
    } else if (rate < 15 && income > 0) {
        tips += `<span style="color: #D97706; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Increase Savings:</span><br>Your savings rate is only ${rate}%. Aim for at least 20% to build a financial cushion.<br><br>`;
    } else if (rate >= 20) {
        tips += `<span style="color: #10B981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Great Savings Rate:</span><br>You saved ${rate}% of your earnings this month. Consider investing the surplus.<br><br>`;
    }

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

// Render monthly reports
function renderMonthlyReportTable() {
    const tableBody = document.getElementById('monthlyReportTableBody');
    if (!tableBody) return;

    const uniqueMonths = new Set();
    state.transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(key);
        }
    });

    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    uniqueMonths.add(currentMonthKey);

    const sortedMonths = Array.from(uniqueMonths).sort().reverse();
    const monthsName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    tableBody.innerHTML = '';
    
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

        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        const closingDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        let prevYear = targetYear;
        let prevMonth = targetMonth - 1;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear -= 1;
        }
        const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
        const openingDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

        const openingBalances = calculateAccountBalances(openingDateStr);
        const closingBalances = calculateAccountBalances(closingDateStr);

        let sumOpening = 0;
        let sumClosing = 0;
        state.accounts.forEach(acc => {
            sumOpening += openingBalances[acc.id] || 0;
            sumClosing += closingBalances[acc.id] || 0;
        });

        const row = document.createElement('tr');
        const savingsColor = netSavings < 0 ? '#F43F5E' : '#14B8A6';
        const rateDisplay = rate < 0 ? '0%' : `${rate}%`;

        row.innerHTML = `
            <td style="font-weight: 700; padding: 0.85rem 1rem;">${monthsName[targetMonth]} ${targetYear}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: var(--text-secondary); font-family: var(--font-heading); font-weight: 600;">${fmt(sumOpening)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: #10B981; font-weight: 600;">+${fmt(income)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: var(--text-primary); font-weight: 600;">-${fmt(expenses)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: ${savingsColor}; font-weight: 700;">${fmt(netSavings)}</td>
            <td style="text-align: center; padding: 0.85rem 1rem; font-weight: 700; color: ${savingsColor};">${rateDisplay}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: var(--primary); font-family: var(--font-heading); font-weight: 700;">${fmt(sumClosing)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Modals Open/Close
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
    if (modal) modal.style.display = 'none';
};

window.openAddCategoryModal = function() {
    const modal = document.getElementById('modal-add-category');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newCatName').value = '';
        document.getElementById('newCatType').value = 'expense';
    }
};

window.closeAddCategoryModal = function() {
    const modal = document.getElementById('modal-add-category');
    if (modal) modal.style.display = 'none';
};

// Form listeners for modals
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
        
        const newAccount = { name, owner, initialBalance, type };
        
        try {
            await apiCall('/api/accounts', 'POST', newAccount);
            await syncStateFromServer();
            closeAddAccountModal();
            showToast('Account created successfully!', 'success');
        } catch (e) {
            showToast('Failed to create account: ' + e.message, 'error');
        }
    });
}

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
            await apiCall('/api/categories', 'POST', { name, type });
            await syncStateFromServer();
            closeAddCategoryModal();
            showToast('Category created successfully!', 'success');
        } catch (e) {
            showToast('Failed to create category: ' + e.message, 'error');
        }
    });
}

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
                throw new Error('Invalid backup file structure.');
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
        event.target.value = '';
    };
    reader.readAsText(file);
};

// Excel CSV export
const btnExportCSV = document.getElementById('btnExportCSV');
if (btnExportCSV) {
    btnExportCSV.addEventListener('click', function() {
        if (state.transactions.length === 0) {
            showToast('There are no transactions to export.', 'error');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Description,Type,Category,Amount (INR),From Account,To Account\n";

        state.transactions.forEach(t => {
            const desc = t.description.replace(/,/g, ' ');
            const fromName = state.accounts.find(a => a.id === t.from_account)?.name || '';
            const toName = state.accounts.find(a => a.id === t.to_account)?.name || '';
            csvContent += `${t.date},${desc},${t.type},${t.category},${t.amount},${fromName},${toName}\n`;
        });

        const encoded = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encoded);
        link.setAttribute("download", `finflow_backup_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Excel CSV exported successfully!', 'success');
    });
}

// Initialise
function initDashboard() {
    document.getElementById('lblUserDisplay').textContent = localStorage.getItem('finflow_username') || 'User';

    const monthSelect = document.getElementById('reportMonthSelect');
    if (monthSelect) {
        monthSelect.addEventListener('change', renderAll);
    }

    // Load cached state first for speed
    loadCachedState();

    // Fetch fresh state
    syncStateFromServer();

    // Poll every 15 seconds
    setInterval(syncStateFromServer, 15000);
}

window.addEventListener('DOMContentLoaded', initDashboard);

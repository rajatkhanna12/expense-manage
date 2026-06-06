// ==========================================
// STATE MANAGEMENT & SIMPLE CATEGORIES
// ==========================================

let state = {
    transactions: [],
    currency: '₹'
};

const categories = {
    expense: ['Food & Groceries', 'Rent & Bills', 'Travel', 'Shopping & Entertainment', 'Others'],
    income: ['Salary', 'Business & Gigs', 'Others']
};

const categoryColors = {
    'Food & Groceries': '#F59E0B',          // Amber
    'Rent & Bills': '#3B82F6',              // Blue
    'Travel': '#8B5CF6',                    // Violet
    'Shopping & Entertainment': '#EC4899',   // Pink
    'Others': '#64748B',                    // Slate
    'Salary': '#10B981',                    // Emerald
    'Business & Gigs': '#34D399',            // Mint
};

const LOCAL_STORAGE_KEY = 'finflow_simple_state';

// ==========================================
// PRE-POPULATED MOCK DEMO DATA
// ==========================================
function getMockData() {
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
        transactions: [
            // Previous Month Income
            { id: 't1', description: 'Corporate Job Salary', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(-1, 1) },
            { id: 't2', description: 'Freelance Design Project', amount: 5500, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(-1, 15) },
            
            // Previous Month Expenses
            { id: 't3', description: 'Apartment Rent & Electricity', amount: 12000, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(-1, 1) },
            { id: 't4', description: 'Weekly Groceries Haul', amount: 2800, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 5) },
            { id: 't5', description: 'Train Booking Ticket', amount: 1200, type: 'expense', category: 'Travel', date: formatRelativeDate(-1, 10) },
            { id: 't6', description: 'Dining out with Friends', amount: 1600, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 14) },
            { id: 't7', description: 'New Wardrobe Clothes', amount: 2500, type: 'expense', category: 'Shopping & Entertainment', date: formatRelativeDate(-1, 20) },
            { id: 't8', description: 'Medicines purchase', amount: 800, type: 'expense', category: 'Others', date: formatRelativeDate(-1, 25) },

            // Current Month Income
            { id: 't9', description: 'Corporate Job Salary', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(0, 1) },
            { id: 't10', description: 'Consulting Contract Work', amount: 8000, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(0, 4) },
            
            // Current Month Expenses
            { id: 't11', description: 'Apartment Rent & Electricity', amount: 12500, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 1) },
            { id: 't12', description: 'Weekly Groceries Restock', amount: 3100, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(0, 3) },
            { id: 't13', description: 'Fuel Refill Tank', amount: 950, type: 'expense', category: 'Travel', date: formatRelativeDate(0, 5) },
            { id: 't14', description: 'Mobile Recharge Plan', amount: 499, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 6) }
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
        } catch (e) {
            console.error('Error loading state:', e);
            state = getMockData();
            saveState();
        }
    } else {
        state = getMockData();
        saveState();
    }
}

function saveState() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
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
            } else {
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
        savingsEl.style.color = '#0D9488'; // Teal for positive
    }

    document.getElementById('lblSavingsPct').textContent = `${savingsRate < 0 ? 0 : savingsRate}% saved from earnings`;

    // Render list
    renderTransactionsList(monthlyTransactions, fmt);

    // Draw chart
    renderDoughnutChart(categorySums);

    // AI Advice Generator
    renderAdvisorStrategy(monthlyIncome, monthlyExpenses, savingsRate, categorySums, fmt);

    // Month-by-Month Savings Table Renderer
    renderMonthlyReportTable();
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

    // Also include current month in case it has no transactions
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
                } else {
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
        const savingsColor = netSavings < 0 ? '#F43F5E' : '#0D9488';
        const rateDisplay = rate < 0 ? '0%' : `${rate}%`;

        row.innerHTML = `
            <td style="font-weight: 700; padding: 0.85rem 1rem;">${monthsName[targetMonth]} ${targetYear}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: #10B981; font-weight: 600;">+${fmt(income)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: #0F172A;">-${fmt(expenses)}</td>
            <td style="text-align: right; padding: 0.85rem 1rem; color: ${savingsColor}; font-weight: 700;">${fmt(netSavings)}</td>
            <td style="text-align: center; padding: 0.85rem 1rem; font-weight: 700; color: ${savingsColor};">${rateDisplay}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Render simple list of logs
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

        const typeSign = tx.type === 'income' ? '+' : '-';
        const amountClass = tx.type === 'income' ? 'plus' : 'minus';

        item.innerHTML = `
            <div class="log-info-group">
                <span class="log-title">${escapeHtml(tx.description)}</span>
                <div class="log-subdetails">
                    <span class="category-tag">${tx.category}</span>
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
    if (confirm('Kya aap is entry ko delete karna chahte hain?')) {
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
                labels: ['No Kharch logged'],
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
        container.innerHTML = '<strong>Aapne abhi koi transactions log nahi kiye hain.</strong> Naya transaction add karein takki hum aapko bachat tips de sakein!';
        return;
    }

    let tips = '';

    // Rule 1: Deficit checks
    if (income > 0 && expenses > income) {
        tips += `<span style="color: #F43F5E; font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> Savdhan! Kharch Kamai Se Jyada Hai:</span><br>Aapne is mahine kamai se ₹${(expenses - income).toLocaleString('en-IN')} zyada kharch kiye hain. Naye kharche turant band karein.<br><br>`;
    } else if (rate < 15 && income > 0) {
        tips += `<span style="color: #D97706; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Bachat Badhayein:</span><br>Aapki bachat sirf ${rate}% hai. Aam taur par kam se kam 20% bachat karna safe hota hai. Food aur shopping ke kharche check karein.<br><br>`;
    } else if (rate >= 20) {
        tips += `<span style="color: #10B981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Bahut Badhiya Bachat:</span><br>Aap ${rate}% bachat kar rahe hain. Yeh ek safe aur behtarin bachat speed hai! Bache hue paise ko invest karne ka sochein.<br><br>`;
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
        tips += `<strong><i class="fa-solid fa-tags"></i> Top Expense Head:</strong><br>Aapka sabse bada kharcha <strong>${maxExpenseCategory}</strong> mein hua hai (₹${maxExpenseVal.toLocaleString('en-IN')} jo ki aapki kamai ka ${pct}% hai). Agar ho sake toh is area mein thodi bachat karein.`;
    }

    container.innerHTML = tips;
}

// ==========================================
// FORM CONTROLLERS & OPTION SWITCHERS
// ==========================================
const logTypeSelect = document.getElementById('logType');
const logCategorySelect = document.getElementById('logCategory');

function updateCategoryOptions() {
    const type = logTypeSelect.value;
    const list = categories[type] || [];
    
    logCategorySelect.innerHTML = '';
    list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        logCategorySelect.appendChild(opt);
    });
}

// Listen to type switch in form
if (logTypeSelect) {
    logTypeSelect.addEventListener('change', updateCategoryOptions);
}

// Save transaction form submit
const form = document.getElementById('simpleLogForm');
if (form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const type = document.getElementById('logType').value;
        const amount = parseFloat(document.getElementById('logAmount').value);
        const description = document.getElementById('logDesc').value.trim();
        const category = document.getElementById('logCategory').value;
        const date = document.getElementById('logDate').value;

        if (isNaN(amount) || amount <= 0 || !description || !category || !date) {
            alert('Kripya saare fields sahi tarike se bharein!');
            return;
        }

        const newLog = {
            id: 't-' + Date.now(),
            description,
            amount,
            type,
            category,
            date
        };

        state.transactions.push(newLog);
        saveState();
        renderAll();

        // Reset form but preserve date and type for quick logging!
        document.getElementById('logAmount').value = '';
        document.getElementById('logDesc').value = '';
    });
}

// ==========================================
// CONTROL UTILITIES
// ==========================================

// Load demo mock data
document.getElementById('btnLoadDemo').addEventListener('click', function() {
    if (confirm('Example data load karein? Purana data delete ho jayega.')) {
        state = getMockData();
        saveState();
        renderAll();
    }
});

// Reset app
document.getElementById('btnResetAll').addEventListener('click', function() {
    if (confirm('Kya aap saare logs delete karke app ko reset karna chahte hain?')) {
        state = {
            transactions: [],
            currency: '₹'
        };
        saveState();
        renderAll();
    }
});

// Excel backup export
document.getElementById('btnExportCSV').addEventListener('click', function() {
    if (state.transactions.length === 0) {
        alert('Export karne ke liye koi transactions nahi hain.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date (Tariq),Description (Hisab),Type,Category,Amount (Rupaye)\n";

    state.transactions.forEach(t => {
        const desc = t.description.replace(/,/g, ' ');
        csvContent += `${t.date},${desc},${t.type === 'income' ? 'Income' : 'Expense'},${t.category},${t.amount}\n`;
    });

    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `hisab_kitab_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Month selector change
const monthSelect = document.getElementById('reportMonthSelect');
if (monthSelect) {
    monthSelect.addEventListener('change', renderAll);
}

// ==========================================
// APP STARTUP INITIALIZATION
// ==========================================
function init() {
    // Load local storage
// ==========================================
// PASSCODE SECURITY LOCK SCREEN LOGIC
// ==========================================
let pinBuffer = '';
let isSettingPasscode = false;

function setupLockScreenState() {
    const savedPin = localStorage.getItem('finflow_passcode');
    const lockTitle = document.getElementById('lockTitle');
    const lockSubtitle = document.getElementById('lockSubtitle');
    const lockScreen = document.getElementById('lockScreen');

    if (!savedPin) {
        // First run: Create a passcode
        isSettingPasscode = true;
        if (lockTitle) lockTitle.textContent = 'Set a Passcode';
        if (lockSubtitle) lockSubtitle.textContent = 'Choose a 4-digit PIN to lock your reports';
        if (lockScreen) lockScreen.classList.remove('hidden');
    } else {
        // Normal run: Enter passcode to unlock
        isSettingPasscode = false;
        if (lockTitle) lockTitle.textContent = 'Enter Passcode';
        if (lockSubtitle) lockSubtitle.textContent = 'Secure your financial logs';
        if (lockScreen) lockScreen.classList.remove('hidden');
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
    const lockScreen = document.getElementById('lockScreen');

    if (isSettingPasscode) {
        localStorage.setItem('finflow_passcode', pinBuffer);
        alert('Passcode set successfully! Remember this passcode.');
        isSettingPasscode = false;
        pinBuffer = '';
        updatePinDots();
        if (lockScreen) lockScreen.classList.add('hidden');
    } else {
        const correctPin = localStorage.getItem('finflow_passcode');
        if (pinBuffer === correctPin) {
            pinBuffer = '';
            updatePinDots();
            if (lockScreen) lockScreen.classList.add('hidden');
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

    // Set dynamic dropdown categories options based on default type selected
    updateCategoryOptions();

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

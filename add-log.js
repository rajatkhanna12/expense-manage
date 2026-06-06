// ==========================================
// ADD LOG CONTROLLER FOR MPA
// ==========================================

// Auth Guard Check
checkAuth();

// Default date to today
const dateInput = document.getElementById('logDate');
if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
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

const logCategorySelect = document.getElementById('logCategory');

function updateCategoryOptions() {
    if (!logCategorySelect) return;
    const prevVal = logCategorySelect.value;
    const type = document.getElementById('logType').value;
    const list = state.categories[type] || [];
    
    logCategorySelect.innerHTML = '';
    list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        logCategorySelect.appendChild(opt);
    });
    
    if (prevVal && list.includes(prevVal)) {
        logCategorySelect.value = prevVal;
    }
}

function updateAccountDropdowns() {
    const fromSelect = document.getElementById('logFromAccount');
    const toSelect = document.getElementById('logToAccount');
    
    if (!fromSelect || !toSelect) return;
    
    const prevFrom = fromSelect.value;
    const prevTo = toSelect.value;
    
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
    
    if (prevFrom && state.accounts.some(a => a.id === prevFrom)) {
        fromSelect.value = prevFrom;
    }
    if (prevTo && state.accounts.some(a => a.id === prevTo)) {
        toSelect.value = prevTo;
    }
}

// Category modal logic
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
    if (modal) modal.style.display = 'none';
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
            
            // Re-fetch category state
            const categories = await apiCall('/api/categories');
            state.categories = categories;
            
            updateCategoryOptions();
            
            // Auto select new category
            if (logCategorySelect) {
                logCategorySelect.value = addedCat.name;
            }
            
            closeAddCategoryModal();
            showToast('Category created successfully!', 'success');
        } catch (err) {
            showToast('Failed to create category: ' + err.message, 'error');
        }
    });
}

// Submit Transaction handler
const logForm = document.getElementById('simpleLogForm');
if (logForm) {
    logForm.addEventListener('submit', async function(e) {
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

        const newLog = { description, amount, type, category, date, fromAccount, toAccount };

        try {
            await apiCall('/api/transactions', 'POST', newLog);
            showToast('Transaction saved successfully!', 'success');
            
            // Redirect back to dashboard page after a small delay to see the toast
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 600);
        } catch (err) {
            showToast('Failed to record transaction: ' + err.message, 'error');
        }
    });
}

// Initialise
async function initAddLog() {
    // Check if there is cached data we can display instantly while loading
    const cached = localStorage.getItem('finflow_cached_state');
    if (cached) {
        try {
            const cachedState = JSON.parse(cached);
            state.accounts = cachedState.accounts || [];
            state.categories = cachedState.categories || state.categories;
        } catch (err) {
            console.error('Error loading cache:', err);
        }
    }
    
    updateAccountDropdowns();
    updateCategoryOptions();

    try {
        // Fetch fresh state in the background
        const [accounts, categories] = await Promise.all([
            apiCall('/api/accounts'),
            apiCall('/api/categories')
        ]);
        state.accounts = accounts;
        state.categories = categories;
        
        // Cache it
        localStorage.setItem('finflow_cached_state', JSON.stringify(state));
        
        updateAccountDropdowns();
        updateCategoryOptions();
    } catch (err) {
        console.error('Error fetching dropdown options:', err);
    }

    // Set initial toggle state from query parameter (e.g. ?type=transfer)
    const params = new URLSearchParams(window.location.search);
    const initialType = params.get('type') || 'expense';
    setFormType(initialType);
}

window.addEventListener('DOMContentLoaded', initAddLog);

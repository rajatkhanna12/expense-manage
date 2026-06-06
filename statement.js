// ==========================================
// STATEMENT CONTROLLER FOR MPA
// ==========================================

// Auth Guard Check
checkAuth();

const urlParams = new URLSearchParams(window.location.search);
const accId = urlParams.get('account');

if (!accId) {
    window.location.href = 'dashboard.html';
}

function getAccountName(id) {
    if (!id) return '';
    const acc = state.accounts.find(a => a.id === id);
    return acc ? acc.name : '';
}

function renderStatement() {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) {
        showToast('Account not found.', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        return;
    }

    // Filter transactions involving this account
    const accTxs = state.transactions.filter(tx => tx.from_account === accId || tx.to_account === accId);
    
    let inflow = 0;
    let outflow = 0;
    
    accTxs.forEach(tx => {
        if (tx.type === 'income' && tx.to_account === accId) {
            inflow += tx.amount;
        } else if (tx.type === 'expense' && tx.from_account === accId) {
            outflow += tx.amount;
        } else if (tx.type === 'transfer') {
            if (tx.to_account === accId) {
                inflow += tx.amount;
            }
            if (tx.from_account === accId) {
                outflow += tx.amount;
            }
        }
    });
    
    const balance = (acc.initial_balance || 0) + inflow - outflow;
    
    // Update KPI UI
    document.getElementById('statementAccountName').textContent = `${acc.name} — Statement (${acc.owner || 'Self'})`;
    document.getElementById('lblStatementInflow').textContent = fmt(inflow);
    document.getElementById('lblStatementOutflow').textContent = fmt(outflow);
    document.getElementById('lblStatementBalance').textContent = fmt(balance);
    
    const listContainer = document.getElementById('statementLogsList');
    const emptyState = document.getElementById('statementEmptyState');
    if (listContainer) {
        listContainer.innerHTML = '';
        
        if (accTxs.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            
            // Sort newest first
            const sorted = [...accTxs].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            sorted.forEach(tx => {
                const item = document.createElement('div');
                item.className = 'log-item';
                
                const dateObj = new Date(tx.date);
                const dateStr = isNaN(dateObj) ? tx.date : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                
                let typeSign = '';
                let amountClass = '';
                let flowDirection = '';
                
                if (tx.type === 'income') {
                    typeSign = '+';
                    amountClass = 'plus';
                    flowDirection = 'Inflow / Credit';
                } else if (tx.type === 'expense') {
                    typeSign = '-';
                    amountClass = 'minus';
                    flowDirection = 'Outflow / Debit';
                } else if (tx.type === 'transfer') {
                    if (tx.to_account === accId) {
                        typeSign = '+';
                        amountClass = 'plus';
                        flowDirection = `Transfer from ${getAccountName(tx.from_account)}`;
                    } else {
                        typeSign = '-';
                        amountClass = 'minus';
                        flowDirection = `Transfer to ${getAccountName(tx.to_account)}`;
                    }
                }
                
                item.innerHTML = `
                    <div class="log-info-group">
                        <span class="log-title">${escapeHtml(tx.description)}</span>
                        <div class="log-subdetails">
                            <span class="category-tag">${tx.category}</span>
                            <span style="font-weight: 600; color: var(--text-secondary);">${flowDirection}</span>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                    <div class="log-value-group">
                        <span class="log-amount ${amountClass}">${typeSign}${fmt(tx.amount)}</span>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }
    }
}

// Initialise
async function initStatement() {
    // Load cache first
    const cached = localStorage.getItem('finflow_cached_state');
    if (cached) {
        try {
            const cachedState = JSON.parse(cached);
            state.accounts = cachedState.accounts || [];
            state.transactions = cachedState.transactions || [];
            renderStatement();
        } catch (err) {
            console.error('Error parsing cached state:', err);
        }
    }

    // Refresh state from server
    try {
        const [accounts, transactions] = await Promise.all([
            apiCall('/api/accounts'),
            apiCall('/api/transactions')
        ]);
        state.accounts = accounts;
        state.transactions = transactions;
        
        // Update Cache
        localStorage.setItem('finflow_cached_state', JSON.stringify(state));
        
        renderStatement();
    } catch (err) {
        console.error('Failed to sync server data for statements:', err);
    }
}

window.addEventListener('DOMContentLoaded', initStatement);

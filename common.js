// ==========================================
// CENTRALIZED STATE & CONFIGURATION
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
    'Transfer': '#6366F1'                   // Indigo
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

    // Fade in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after animation completes
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// ==========================================
// REST API CLIENT
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
    
    // Resolve Backend Server URL
    let apiBase = 'https://api.businessbox.in';
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.');
    
    if (isLocal) {
        if (window.location.port && window.location.port !== '5500') {
            apiBase = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
        } else {
            apiBase = 'http://localhost:8080';
        }
    }
    
    // Explicit saved API URL configuration
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
            // Avoid infinite redirect loops on login page itself
            if (!window.location.pathname.endsWith('login.html')) {
                logoutUser();
                throw new Error('Session expired. Please login again.');
            }
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

// ==========================================
// SESSION CONTROLS
// ==========================================
function logoutUser() {
    localStorage.removeItem('finflow_token');
    localStorage.removeItem('finflow_username');
    localStorage.removeItem('finflow_user_id');
    localStorage.removeItem('finflow_cached_state');
    
    state.transactions = [];
    state.accounts = [];
    
    window.location.href = 'login.html';
}

function checkAuth() {
    const token = localStorage.getItem('finflow_token');
    if (!token && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
}

// ==========================================
// HELPERS
// ==========================================
function fmt(val) {
    return '₹' + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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

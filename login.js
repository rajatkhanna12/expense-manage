// ==========================================
// AUTHENTICATION LOGIC FOR MPA
// ==========================================
let authMode = 'login'; // 'login' or 'register'

// Redirect to dashboard immediately if token exists
const token = localStorage.getItem('finflow_token');
if (token) {
    window.location.href = 'dashboard.html';
}

function setupLockScreenState() {
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
}

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
        if (lockTitle) lockTitle.textContent = 'Register on FinFlow';
        if (lockSubtitle) lockSubtitle.textContent = 'Create a secure account with a password';
        if (authToggleLabel) authToggleLabel.textContent = 'Have an account?';
        if (authToggleLink) authToggleLink.textContent = 'Login here';
        if (btnAuthSubmit) btnAuthSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i> Register';
    }
    document.getElementById('lockFooterMessage').textContent = '';
};

// Form submit handler
const authForm = document.getElementById('authForm');
if (authForm) {
    authForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
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
            
            if (footerMsg) footerMsg.textContent = '';
            passwordInput.value = '';
            
            // Redirect to dashboard page
            window.location.href = 'dashboard.html';
        } catch (err) {
            if (footerMsg) {
                footerMsg.textContent = err.message || 'Authentication failed.';
                footerMsg.style.color = 'var(--danger)';
            }
        }
    });
}

// Initialise page settings
window.addEventListener('DOMContentLoaded', setupLockScreenState);

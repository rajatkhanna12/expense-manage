const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'finflow_secret_key_change_in_production';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Generate UUID/Random Hex
function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token missing' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// AUTHENTICATION API
// ==========================================

// Register a new account
app.post('/api/auth/register', async (req, res) => {
    const { username, pin } = req.body;

    if (!username || !pin) {
        return res.status(400).json({ error: 'Username and PIN are required' });
    }

    if (pin.length !== 4 || isNaN(pin)) {
        return res.status(400).json({ error: 'PIN must be a 4-digit number' });
    }

    try {
        const normalizedUsername = username.trim().toLowerCase();
        
        // Check if user already exists
        const existingUser = await db.get('SELECT * FROM users WHERE username = $1', [normalizedUsername]);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash the PIN code
        const pinHash = await bcrypt.hash(pin, 10);
        const userId = generateId();

        // Save new user
        await db.run('INSERT INTO users (id, username, pin_hash) VALUES ($1, $2, $3)', [
            userId,
            normalizedUsername,
            pinHash
        ]);

        // Create default accounts for new user
        const defaultAccounts = [
            { id: 'acc-hdfc-' + userId, name: 'HDFC Bank', owner: username, type: 'bank', balance: 0 },
            { id: 'acc-sbi-' + userId, name: 'SBI Bank', owner: username, type: 'bank', balance: 0 },
            { id: 'acc-savings-' + userId, name: 'Savings Account', owner: username, type: 'savings', balance: 0 },
            { id: 'acc-cash-' + userId, name: 'Cash', owner: username, type: 'cash', balance: 0 }
        ];

        for (const acc of defaultAccounts) {
            await db.run(
                'INSERT INTO accounts (id, user_id, name, owner, initial_balance, type) VALUES ($1, $2, $3, $4, $5, $6)',
                [acc.id, userId, acc.name, acc.owner, acc.balance, acc.type]
            );
        }

        // Create default categories for new user
        const defaultCategories = [
            { name: 'Food & Groceries', type: 'expense', color: '#F59E0B' },
            { name: 'Rent & Bills', type: 'expense', color: '#3B82F6' },
            { name: 'Travel', type: 'expense', color: '#8B5CF6' },
            { name: 'Shopping & Entertainment', type: 'expense', color: '#EC4899' },
            { name: 'Others', type: 'expense', color: '#64748B' },
            { name: 'Salary', type: 'income', color: '#10B981' },
            { name: 'Business & Gigs', type: 'income', color: '#34D399' },
            { name: 'Others', type: 'income', color: '#64748B' }
        ];

        for (const cat of defaultCategories) {
            await db.run(
                'INSERT INTO categories (id, user_id, name, type, color) VALUES ($1, $2, $3, $4, $5)',
                ['cat-' + generateId(), userId, cat.name, cat.type, cat.color]
            );
        }

        // Generate session JWT token
        const token = jwt.sign({ id: userId, username: normalizedUsername }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: userId, username: normalizedUsername }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, pin } = req.body;

    if (!username || !pin) {
        return res.status(400).json({ error: 'Username and PIN are required' });
    }

    try {
        const normalizedUsername = username.trim().toLowerCase();
        
        // Find user
        const user = await db.get('SELECT * FROM users WHERE username = $1', [normalizedUsername]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or passcode' });
        }

        // Match PIN
        const isValid = await bcrypt.compare(pin, user.pin_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or passcode' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// ==========================================
// ACCOUNTS API
// ==========================================

// Get accounts
app.get('/api/accounts', authenticateToken, async (req, res) => {
    try {
        const accounts = await db.query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
        res.json(accounts);
    } catch (err) {
        console.error('Error fetching accounts:', err);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Create account
app.post('/api/accounts', authenticateToken, async (req, res) => {
    const { name, owner, initialBalance, type } = req.body;

    if (!name || !owner || type === undefined) {
        return res.status(400).json({ error: 'Missing required account fields' });
    }

    try {
        const id = 'acc-' + generateId();
        const balance = parseFloat(initialBalance) || 0;

        await db.run(
            'INSERT INTO accounts (id, user_id, name, owner, initial_balance, type) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, req.user.id, name.trim(), owner.trim(), balance, type]
        );

        const newAccount = await db.get('SELECT * FROM accounts WHERE id = $1', [id]);
        res.status(201).json(newAccount);
    } catch (err) {
        console.error('Error creating account:', err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Delete account
app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
    try {
        // Confirm account ownership
        const account = await db.get('SELECT * FROM accounts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (!account) {
            return res.status(404).json({ error: 'Account not found or access denied' });
        }

        // Delete account (cascade deletes transaction records on foreign key, or sets account references to NULL depending on constraints)
        // Since sqlite/pg has standard delete, let's run it
        await db.run('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

        // Clean up transactions associated with this account (if they aren't fully deleted, let's clear them)
        await db.run(
            'DELETE FROM transactions WHERE user_id = $1 AND from_account IS NULL AND to_account IS NULL AND type = $2',
            [req.user.id, 'transfer']
        );

        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ==========================================
// TRANSACTIONS API
// ==========================================

// Get transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await db.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC', [req.user.id]);
        res.json(transactions);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Create transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { description, amount, type, category, date, fromAccount, toAccount } = req.body;

    if (!description || amount === undefined || !type || !category || !date) {
        return res.status(400).json({ error: 'Missing required transaction fields' });
    }

    try {
        const id = 't-' + generateId();
        const parsedAmount = parseFloat(amount);

        await db.run(
            'INSERT INTO transactions (id, user_id, description, amount, type, category, date, from_account, to_account) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
                id,
                req.user.id,
                description.trim(),
                parsedAmount,
                type,
                category,
                date,
                fromAccount || null,
                toAccount || null
            ]
        );

        const newTx = await db.get('SELECT * FROM transactions WHERE id = $1', [id]);
        res.status(201).json(newTx);
    } catch (err) {
        console.error('Error creating transaction:', err);
        res.status(500).json({ error: 'Failed to record transaction' });
    }
});

// Delete transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const result = await db.run('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.changes === 0 || result.rowCount === 0) {
            return res.status(404).json({ error: 'Transaction not found or access denied' });
        }
        res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// ==========================================
// CATEGORIES API
// ==========================================

// Get custom categories
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await db.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
        
        // Group by type (expense / income)
        const grouped = { expense: [], income: [] };
        categories.forEach(cat => {
            if (grouped[cat.type]) grouped[cat.type].push(cat.name);
        });

        res.json(grouped);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create custom category
app.post('/api/categories', authenticateToken, async (req, res) => {
    const { name, type } = req.body;

    if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
    }

    try {
        const id = 'cat-' + generateId();
        const colors = ['#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#34D399', '#6366F1', '#06B6D4', '#F43F5E', '#14B8A6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // Check duplicates
        const exists = await db.get('SELECT * FROM categories WHERE user_id = $1 AND name = $2 AND type = $3', [
            req.user.id,
            name.trim(),
            type
        ]);

        if (exists) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        await db.run('INSERT INTO categories (id, user_id, name, type, color) VALUES ($1, $2, $3, $4, $5)', [
            id,
            req.user.id,
            name.trim(),
            type,
            randomColor
        ]);

        res.status(201).json({ name: name.trim(), type, color: randomColor });
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// ==========================================
// SYSTEM / MOCK DATA UTILITIES
// ==========================================

// Reset and load Demo Mock Data for the user
app.post('/api/demo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Delete user's current transactions and accounts
        await db.run('DELETE FROM transactions WHERE user_id = $1', [userId]);
        await db.run('DELETE FROM accounts WHERE user_id = $1', [userId]);

        // 2. Insert mock accounts with initial balances
        const mockAccounts = [
            { id: 'acc-hdfc-' + userId, name: 'HDFC Bank', owner: req.user.username, type: 'bank', balance: 25000 },
            { id: 'acc-sbi-' + userId, name: 'SBI Bank', owner: req.user.username, type: 'bank', balance: 15000 },
            { id: 'acc-savings-' + userId, name: 'Savings Account', owner: req.user.username, type: 'savings', balance: 50000 },
            { id: 'acc-cash-' + userId, name: 'Cash', owner: req.user.username, type: 'cash', balance: 2000 }
        ];

        for (const acc of mockAccounts) {
            await db.run(
                'INSERT INTO accounts (id, user_id, name, owner, initial_balance, type) VALUES ($1, $2, $3, $4, $5, $6)',
                [acc.id, userId, acc.name, acc.owner, acc.balance, acc.type]
            );
        }

        // Helper for mock transaction dates
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonthNum = today.getMonth();

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

        // 3. Insert mock transactions
        const mockTxs = [
            // Previous Month Income
            { id: 't1-' + userId, description: 'Client A Project Payment', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(-1, 1), from: null, to: 'acc-hdfc-' + userId },
            { id: 't2-' + userId, description: 'Freelance Design Work', amount: 5500, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(-1, 15), from: null, to: 'acc-sbi-' + userId },
            
            // Previous Month Expenses
            { id: 't3-' + userId, description: 'Apartment Rent HDFC', amount: 12000, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(-1, 1), from: 'acc-hdfc-' + userId, to: null },
            { id: 't4-' + userId, description: 'Weekly Groceries Cash', amount: 2800, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 5), from: 'acc-cash-' + userId, to: null },
            { id: 't5-' + userId, description: 'Savings Allocation', amount: 15000, type: 'transfer', category: 'Transfer', date: formatRelativeDate(-1, 10), from: 'acc-hdfc-' + userId, to: 'acc-savings-' + userId },
            { id: 't6-' + userId, description: 'Dining out with Friends', amount: 1600, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(-1, 14), from: 'acc-sbi-' + userId, to: null },
            { id: 't7-' + userId, description: 'Online Shopping HDFC', amount: 2500, type: 'expense', category: 'Shopping & Entertainment', date: formatRelativeDate(-1, 20), from: 'acc-hdfc-' + userId, to: null },
            { id: 't8-' + userId, description: 'Medicines purchase', amount: 800, type: 'expense', category: 'Others', date: formatRelativeDate(-1, 25), from: 'acc-cash-' + userId, to: null },

            // Current Month Income
            { id: 't9-' + userId, description: 'Corporate Job Salary', amount: 45000, type: 'income', category: 'Salary', date: formatRelativeDate(0, 1), from: null, to: 'acc-hdfc-' + userId },
            { id: 't10-' + userId, description: 'Consulting Contract Work', amount: 8000, type: 'income', category: 'Business & Gigs', date: formatRelativeDate(0, 4), from: null, to: 'acc-hdfc-' + userId },
            
            // Current Month Expenses
            { id: 't11-' + userId, description: 'Apartment Rent HDFC', amount: 12500, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 1), from: 'acc-hdfc-' + userId, to: null },
            { id: 't12-' + userId, description: 'Weekly Groceries Restock', amount: 3100, type: 'expense', category: 'Food & Groceries', date: formatRelativeDate(0, 3), from: 'acc-sbi-' + userId, to: null },
            { id: 't13-' + userId, description: 'Savings Transfer', amount: 10000, type: 'transfer', category: 'Transfer', date: formatRelativeDate(0, 5), from: 'acc-hdfc-' + userId, to: 'acc-savings-' + userId },
            { id: 't14-' + userId, description: 'Fuel Refill Tank', amount: 950, type: 'expense', category: 'Travel', date: formatRelativeDate(0, 5), from: 'acc-hdfc-' + userId, to: null },
            { id: 't15-' + userId, description: 'Mobile Recharge Plan', amount: 499, type: 'expense', category: 'Rent & Bills', date: formatRelativeDate(0, 6), from: 'acc-sbi-' + userId, to: null }
        ];

        for (const tx of mockTxs) {
            await db.run(
                'INSERT INTO transactions (id, user_id, description, amount, type, category, date, from_account, to_account) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [tx.id, userId, tx.description, tx.amount, tx.type, tx.category, tx.date, tx.from, tx.to]
            );
        }

        res.json({ message: 'Demo data loaded successfully' });
    } catch (err) {
        console.error('Error loading demo data:', err);
        res.status(500).json({ error: 'Failed to load demo mock data' });
    }
});

// Clear All Data for the user (Reset User Account)
app.post('/api/reset', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Delete user's transactions and accounts
        await db.run('DELETE FROM transactions WHERE user_id = $1', [userId]);
        await db.run('DELETE FROM accounts WHERE user_id = $1', [userId]);

        res.json({ message: 'All user data reset successfully' });
    } catch (err) {
        console.error('Error resetting user data:', err);
        res.status(500).json({ error: 'Failed to reset data' });
    }
});

// Fallback to serving the main SPA page for client side routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server after database initialization
db.initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`===================================================`);
        console.log(`FinFlow Server running at http://localhost:${PORT}`);
        console.log(`===================================================`);
    });
});

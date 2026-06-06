const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const isPostgres = !!process.env.DATABASE_URL;
let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
    console.log('Database Mode: PostgreSQL');
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    console.log('Database Mode: SQLite');
    const dbFile = process.env.DATABASE_FILE || './database.db';
    sqliteDb = new sqlite3.Database(dbFile, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err);
        } else {
            // Enable foreign keys
            sqliteDb.run('PRAGMA foreign_keys = ON;', (err) => {
                if (err) console.error('Error enabling foreign keys:', err);
            });
        }
    });
}

// Helper: Convert Postgres $1, $2 placeholders to ? for SQLite
function prepareQuery(sql, params) {
    if (isPostgres) {
        return { sql, params };
    } else {
        const sqliteSql = sql.replace(/\$\d+/g, '?');
        return { sql: sqliteSql, params };
    }
}

function query(sql, params = []) {
    const prepared = prepareQuery(sql, params);
    return new Promise((resolve, reject) => {
        if (isPostgres) {
            pgPool.query(prepared.sql, prepared.params, (err, result) => {
                if (err) return reject(err);
                resolve(result.rows);
            });
        } else {
            sqliteDb.all(prepared.sql, prepared.params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        }
    });
}

function get(sql, params = []) {
    const prepared = prepareQuery(sql, params);
    return new Promise((resolve, reject) => {
        if (isPostgres) {
            pgPool.query(prepared.sql, prepared.params, (err, result) => {
                if (err) return reject(err);
                resolve(result.rows[0] || null);
            });
        } else {
            sqliteDb.get(prepared.sql, prepared.params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        }
    });
}

function run(sql, params = []) {
    const prepared = prepareQuery(sql, params);
    return new Promise((resolve, reject) => {
        if (isPostgres) {
            pgPool.query(prepared.sql, prepared.params, (err, result) => {
                if (err) return reject(err);
                resolve({ rowCount: result.rowCount });
            });
        } else {
            sqliteDb.run(prepared.sql, prepared.params, function(err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
}

async function initDatabase() {
    console.log('Initializing database tables...');
    try {
        // Users Table
        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                pin_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Accounts Table
        await run(`
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                owner TEXT NOT NULL,
                initial_balance NUMERIC DEFAULT 0,
                type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Transactions Table
        await run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                description TEXT NOT NULL,
                amount NUMERIC NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL,
                date TEXT NOT NULL,
                from_account TEXT REFERENCES accounts(id) ON DELETE SET NULL,
                to_account TEXT REFERENCES accounts(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Categories Table
        await run(`
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables verified/created successfully.');
    } catch (err) {
        console.error('Critical database initialization error:', err);
        process.exit(1);
    }
}

module.exports = {
    query,
    get,
    run,
    initDatabase
};

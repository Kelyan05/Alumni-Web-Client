const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

class Database {
  constructor() {
    this.db = null;
    // Ensure data directory exists
    const dbPath = process.env.DB_PATH || './data/alumni.db';
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.dbPath = path.resolve(dbPath);
  }

  /** Returns the singleton instance */
  static getInstance() {
    if (!Database._instance) Database._instance = new Database();
    return Database._instance;
  }

  open() {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve();
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        // Enable foreign-key enforcement
        this.db.run('PRAGMA foreign_keys = ON', resolve);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.close((err) => {
        if (err) return reject(err);
        this.db = null;
        resolve();
      });
    });
  }

  /** Execute a statement (INSERT / UPDATE / DELETE / CREATE) */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /** Fetch a single row */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  /** Fetch multiple rows */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = Database;
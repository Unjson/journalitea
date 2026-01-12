const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron/main');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  initialize(dbName = 'app.db') {
    if (this.db) return this.db;

    const dbPath = path.join(app.getPath('userData'), dbName);
    this.db = new Database(dbPath);
    console.log(`Database initialized: ${dbPath}`);
    return this.db;
  }

  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new DatabaseService();

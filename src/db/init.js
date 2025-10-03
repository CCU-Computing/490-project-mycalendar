const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "../../data/mycalendar.db");
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql");

let db = null;

/**
 * initialize and return the database connection
 * creates the database file and schema if they don't exist (they do)
 */
function getDatabase() {
  if (db) {
    return db;
  }

  // ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // create/open database
  db = new Database(DB_PATH);

  // enable foreign keys
  db.pragma("foreign_keys = ON");

  // check if schema needs to be initialized
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();

  if (tables.length === 0) {
    console.log("[db] Initializing database schema...");
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    db.exec(schema);
    console.log("[db] Schema initialized successfully");
  }

  return db;
}

/**
 * close the database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
  * run a migration script
 */
function runMigration(migrationSQL) {
  const database = getDatabase();
  database.exec(migrationSQL);
}

module.exports = {
  getDatabase,
  closeDatabase,
  runMigration,
};

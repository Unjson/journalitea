import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { Record } from '../models/record';

class DatabaseService {
  private db: Database.Database | null = null;

  initialize(dbName: string = 'app.db'): Database.Database {
    if (this.db) return this.db;

    const dbPath = path.join(app.getPath('userData'), dbName);
    this.db = new Database(dbPath);
    console.log(`Database initialized: ${dbPath}`);
    
    this.createRecordsTable();
    return this.db;
  }

  listRecords(): Record[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM records ORDER BY date_added DESC');
    const rows = stmt.all();
    
    return rows.map(row => this.rowToRecord(row));
  }

  getRecordById(id: number): Record | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM records WHERE id = ?');
    const row = stmt.get(id);
    
    return row ? this.rowToRecord(row) : null;
  }

  saveRecord(record: Record): number {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO records (
        name, type, sub_type, date_added, seller, origin, year, price, price_currency,
        weight, weight_unit, preparation_method, preparation_notes, dry_leaves,
        wet_leaves, liquor, color, aroma_sweet, aroma_floral, aroma_nutty,
        aroma_spicy, aroma_fire, aroma_fruity, aroma_plants, aroma_earthy,
        aroma_minerals, aroma_marine, notes, rating, photo
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);
    
    const result = stmt.run(
      record.name,
      record.type,
      record.subtype,
      record.dateAdded.toISOString(),
      record.seller,
      record.origin,
      record.year,
      record.price,
      record.price_currency,
      record.weight,
      record.weightUnit,
      record.preparationMethod,
      record.preparationNotes,
      record.dryLeaves,
      record.wetLeaves,
      record.liquor,
      record.color,
      record.aroma_sweet,
      record.aroma_floral,
      record.aroma_nutty,
      record.aroma_spicy,
      record.aroma_fire,
      record.aroma_fruity,
      record.aroma_plants,
      record.aroma_earthy,
      record.aroma_minerals,
      record.aroma_marine,
      record.notes,
      record.rating,
      record.photo
    );
    
    return result.lastInsertRowid as number;
  }

  updateRecord(record: Record): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      UPDATE records SET
        name = ?, type = ?, sub_type = ?, date_added = ?, seller = ?, origin = ?,
        year = ?, price = ?, price_currency = ?, weight = ?, weight_unit = ?,
        preparation_method = ?, preparation_notes = ?, dry_leaves = ?, wet_leaves = ?,
        liquor = ?, color = ?, aroma_sweet = ?, aroma_floral = ?, aroma_nutty = ?,
        aroma_spicy = ?, aroma_fire = ?, aroma_fruity = ?, aroma_plants = ?,
        aroma_earthy = ?, aroma_minerals = ?, aroma_marine = ?, notes = ?,
        rating = ?, photo = ?
      WHERE id = ?
    `);
    
    stmt.run(
      record.name,
      record.type,
      record.subtype,
      record.dateAdded.toISOString(),
      record.seller,
      record.origin,
      record.year,
      record.price,
      record.price_currency,
      record.weight,
      record.weightUnit,
      record.preparationMethod,
      record.preparationNotes,
      record.dryLeaves,
      record.wetLeaves,
      record.liquor,
      record.color,
      record.aroma_sweet,
      record.aroma_floral,
      record.aroma_nutty,
      record.aroma_spicy,
      record.aroma_fire,
      record.aroma_fruity,
      record.aroma_plants,
      record.aroma_earthy,
      record.aroma_minerals,
      record.aroma_marine,
      record.notes,
      record.rating,
      record.photo,
      record.id
    );
  }

  private rowToRecord(row: any): Record {
    const record = new Record();
    record.id = row.id;
    record.name = row.name;
    record.type = row.type;
    record.subtype = row.sub_type;
    record.dateAdded = new Date(row.date_added);
    record.seller = row.seller;
    record.origin = row.origin;
    record.year = row.year;
    record.price = row.price;
    record.price_currency = row.price_currency;
    record.weight = row.weight;
    record.weightUnit = row.weight_unit;
    record.preparationMethod = row.preparation_method;
    record.preparationNotes = row.preparation_notes;
    record.dryLeaves = row.dry_leaves;
    record.wetLeaves = row.wet_leaves;
    record.liquor = row.liquor;
    record.color = row.color;
    record.aroma_sweet = row.aroma_sweet;
    record.aroma_floral = row.aroma_floral;
    record.aroma_nutty = row.aroma_nutty;
    record.aroma_spicy = row.aroma_spicy;
    record.aroma_fire = row.aroma_fire;
    record.aroma_fruity = row.aroma_fruity;
    record.aroma_plants = row.aroma_plants;
    record.aroma_earthy = row.aroma_earthy;
    record.aroma_minerals = row.aroma_minerals;
    record.aroma_marine = row.aroma_marine;
    record.notes = row.notes;
    record.rating = row.rating;
    record.photo = row.photo;
    return record;
  }

    private createRecordsTable(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        sub_type TEXT,
        date_added TEXT NOT NULL,
        seller TEXT,
        origin TEXT,
        year INTEGER,
        price REAL,
        price_currency INTEGER,
        weight REAL,
        weight_unit INTEGER,
        preparation_method TEXT,
        preparation_notes TEXT,
        dry_leaves TEXT,
        wet_leaves TEXT,
        liquor TEXT,
        color INTEGER,
        aroma_sweet INTEGER,
        aroma_floral INTEGER,
        aroma_nutty INTEGER,
        aroma_spicy INTEGER,
        aroma_fire INTEGER,
        aroma_fruity INTEGER,
        aroma_plants INTEGER,
        aroma_earthy INTEGER,
        aroma_minerals INTEGER,
        aroma_marine INTEGER,
        notes TEXT,
        rating INTEGER,
        photo BLOB
      )
    `);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  getPath(): string | null {
    return this.db ? (this.db as any).name : null;
  }
}

export default new DatabaseService();

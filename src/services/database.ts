import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { mapRecordPhotoPaths, Record } from "../models/record.js";
import {
  APP_USER_FOLDER,
  DATABASE_NAME,
  PREFS,
  DEFAULT_PREFS,
} from "../appSettings.js";
import {
  buildRecordPageQuery,
  createRecordsTableSql,
  createSettingsTableSql,
  deleteRecordSql,
  getRecordByIdSql,
  insertRecordSql,
  insertSettingSql,
  listRecordYearsSql,
  listRecordsByYearSql,
  listRecordsSql,
  type RecordPageQuery,
  selectSettingIdSql,
  selectSettingsValueSql,
  settingsValueExistsSql,
  updateRecordSql,
  updateSettingSql,
} from "./databaseQueries.js";
import {
  normalizePhotoRelativePath,
  PHOTO_ROOT_FOLDER,
  replacePhotoRecordId,
} from "./photoStorageShared.js";
import type { PhotoImportIdMapEntry } from "./photoTypes.js";

const rewriteImportedPhotoRaw = (
  photoRaw: string,
  sourceId: number,
  targetId: number,
): string =>
  mapRecordPhotoPaths(photoRaw, (photoPath) => {
    const normalized = normalizePhotoRelativePath(photoPath);
    const parts = normalized.split("/");
    if (parts.length < 3 || parts[0] !== PHOTO_ROOT_FOLDER) {
      return normalized;
    }

    const referencedId = Number(parts[1]);
    if (!Number.isFinite(referencedId) || referencedId !== sourceId) {
      return normalized;
    }

    return replacePhotoRecordId(normalized, targetId);
  });

class DatabaseService {
  private db: Database.Database | null = null;

  initialize(dbName: string = DATABASE_NAME): Database.Database {
    if (this.db) return this.db;
    const dbDirectory = path.join(app.getPath("userData"), APP_USER_FOLDER);
    fs.mkdirSync(dbDirectory, {
      recursive: true,
    });

    const dbPath = path.join(dbDirectory, dbName);
    this.ensureWritableDatabasePath(dbPath);
    this.db = new Database(dbPath);
    console.log(`Database initialized: ${dbPath}`);

    this.createRecordsTable();
    this.createSettingsTable();
    this.fillSettingsWithDefaultValues();
    return this.db;
  }

  listRecords(year: number | null = null): Record[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = year
      ? this.db.prepare(listRecordsByYearSql)
      : this.db.prepare(listRecordsSql);
    const rows = year ? stmt.all(String(year)) : stmt.all();

    return rows.map((row) => this.rowToRecord(row));
  }

  listRecordsPage(query: RecordPageQuery): Record[] {
    if (!this.db) throw new Error("Database not initialized");

    const { sql, params } = buildRecordPageQuery(query);
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row) => this.rowToRecord(row));
  }

  listRecordYears(): number[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(listRecordYearsSql);
    const rows = stmt.all() as { year: number }[];
    return rows
      .map((row) => Number(row.year))
      .filter((year) => Number.isFinite(year));
  }

  getRecordCount(): number {
    if (!this.db) throw new Error("Database not initialized");

    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM records")
      .get() as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }

  getRecordById(id: number): Record | null {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(getRecordByIdSql);
    const row = stmt.get(id);

    return row ? this.rowToRecord(row) : null;
  }

  saveRecord(record: Record): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(insertRecordSql);

    const result = stmt.run(
      record.name,
      record.type,
      record.subtype,
      record.dateAdded.toISOString(),
      record.seller,
      record.origin,
      record.year,
      record.price,
      record.priceCurrency,
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
    );

    return result.lastInsertRowid as number;
  }

  updateRecord(record: Record): void {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(updateRecordSql);

    stmt.run(
      record.name,
      record.type,
      record.subtype,
      record.dateAdded.toISOString(),
      record.seller,
      record.origin,
      record.year,
      record.price,
      record.priceCurrency,
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
      record.id,
    );
  }

  deleteRecord(id: number): void {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(deleteRecordSql);
    stmt.run(id);
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
    record.priceCurrency = row.price_currency;
    record.weight = row.weight;
    record.weightUnit = row.weight_unit;
    record.preparationMethod = Number(row.preparation_method);
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

  setSetingsValue(
    key: string,
    intVal: number | null,
    strVal: string | null,
  ): void {
    if (!this.db) throw new Error("Database not initialized");

    //Check is key already exists in DB
    const selectStmt = this.db.prepare(selectSettingIdSql);
    const row = selectStmt.get(key) as { id: number } | undefined;
    const id = row ? row.id : null;

    if (id) {
      const updateStmt = this.db.prepare(updateSettingSql);
      updateStmt.run(intVal, strVal, key);
      return;
    } else {
      const insertStmt = this.db.prepare(insertSettingSql);
      insertStmt.run(key, intVal, strVal);
    }
  }

  getSettingsValue(
    key: string,
  ): { intVal: number | null; strVal: string } | null {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(selectSettingsValueSql);
    const row = stmt.get(key) as
      | { int_val: number | null; str_val: string | null }
      | undefined;

    if (!row) return { intVal: -1, strVal: "" };
    else return { intVal: row.int_val ?? -1, strVal: row.str_val ?? "" };
  }

  private createRecordsTable(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.exec(createRecordsTableSql);
  }

  private createSettingsTable(): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.exec(createSettingsTableSql);
  }

  private fillSettingsWithDefaultValues(): void {
    if (!this.db) throw new Error("Database not initialized");

    const defaultSettings: {
      key: string;
      intVal: number | null;
      strVal: string | null;
    }[] = [
      { key: PREFS.CURRENCY, intVal: DEFAULT_PREFS.CURRENCY, strVal: null },
      {
        key: PREFS.WEIGHT_UNIT,
        intVal: DEFAULT_PREFS.WEIGHT_UNIT,
        strVal: null,
      },
      { key: PREFS.LANGUAGE, intVal: DEFAULT_PREFS.LANGUAGE, strVal: null },
      {
        key: PREFS.HISTOGRAM_BUCKETS,
        intVal: DEFAULT_PREFS.HISTOGRAM_BUCKETS,
        strVal: null,
      },
      {
        key: PREFS.CUSTOM_CURRENCY,
        intVal: null,
        strVal: JSON.stringify(DEFAULT_PREFS.CUSTOM_CURRENCY),
      },
      {
        key: PREFS.EXCHANGE_RATES,
        intVal: null,
        strVal: JSON.stringify(DEFAULT_PREFS.EXCHANGE_RATES),
      },
    ];

    const insertStmt = this.db.prepare(insertSettingSql);
    for (const setting of defaultSettings) {
      if (!this.settingsValueExists(setting.key)) {
        insertStmt.run(setting.key, setting.intVal, setting.strVal);
      }
    }
  }

  private settingsValueExists(key: string): boolean {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(settingsValueExistsSql);
    const row = stmt.get(key);
    return !!row;
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

  exportDatabase(destinationPath: string): void {
    if (!this.db) throw new Error("Database not initialized");
    const dbPath = this.getPath();
    if (!dbPath) throw new Error("Database path not available");
    fs.copyFileSync(dbPath, destinationPath);
  }

  importDatabase(sourcePath: string): void {
    const dbPath = this.getPath();
    if (!dbPath) throw new Error("Database path not available");
    this.close();
    fs.copyFileSync(sourcePath, dbPath);
    this.ensureWritableDatabasePath(dbPath);
    this.initialize();
  }

  private ensureWritableDatabasePath(dbPath: string): void {
    if (!fs.existsSync(dbPath)) {
      return;
    }

    try {
      fs.chmodSync(dbPath, 0o600);
    } catch (error) {
      console.warn(`Failed to ensure database is writable: ${dbPath}`, error);
    }
  }

  appendDatabaseRecords(sourcePath: string): PhotoImportIdMapEntry[] {
    if (!this.db) throw new Error("Database not initialized");

    const sourceDb = new Database(sourcePath, { readonly: true });
    try {
      const rows = sourceDb
        .prepare(
          `SELECT
            id, name, type, sub_type, date_added, seller, origin, year, price, price_currency,
            weight, weight_unit, preparation_method, preparation_notes, dry_leaves,
            wet_leaves, liquor, color, aroma_sweet, aroma_floral, aroma_nutty,
            aroma_spicy, aroma_fire, aroma_fruity, aroma_plants, aroma_earthy,
            aroma_minerals, aroma_marine, notes, rating, photo
          FROM records`,
        )
        .all();

      if (rows.length === 0) return [];

      const insertStmt = this.db.prepare(`
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

      const updatePhotoStmt = this.db.prepare(
        "UPDATE records SET photo = ? WHERE id = ?",
      );

      const insertMany = this.db.transaction((records: any[]) => {
        const idMapEntries: PhotoImportIdMapEntry[] = [];
        for (const record of records) {
          const insertResult = insertStmt.run(
            record.name,
            record.type,
            record.sub_type,
            record.date_added,
            record.seller,
            record.origin,
            record.year,
            record.price,
            record.price_currency,
            record.weight,
            record.weight_unit,
            record.preparation_method,
            record.preparation_notes,
            record.dry_leaves,
            record.wet_leaves,
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
            "",
          );

          const sourceId = Number(record.id ?? -1);
          const targetId = Number(insertResult.lastInsertRowid ?? -1);
          if (Number.isFinite(sourceId) && sourceId > 0) {
            idMapEntries.push({ sourceId, targetId });
          }

          const rewrittenPhoto = rewriteImportedPhotoRaw(
            String(record.photo ?? ""),
            sourceId,
            targetId,
          );
          if (rewrittenPhoto) {
            updatePhotoStmt.run(rewrittenPhoto, targetId);
          }
        }

        return idMapEntries;
      });

      return insertMany(rows);
    } finally {
      sourceDb.close();
    }
  }
}

export default new DatabaseService();

import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { DEFAULT_PREFS, DATABASE_NAME, PREFS } from "../appSettings";
import { Record } from "../models/record";
import {
  createRecordsTableSql,
  createSettingsTableSql,
  deleteRecordSql,
  getRecordByIdSql,
  insertRecordSql,
  insertSettingSql,
  listRecordYearsSql,
  listRecordsByYearSql,
  listRecordsSql,
  selectSettingIdSql,
  selectSettingsValueSql,
  settingsValueExistsSql,
  updateRecordSql,
  updateSettingSql,
} from "./databaseQueries";

const DATABASE_VERSION = 1;

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

class CapacitorDatabaseService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initializing: Promise<void> | null = null;

  private async ensureReady(): Promise<void> {
    if (this.db) return;
    if (!this.initializing) {
      this.initializing = this.initialize();
    }
    await this.initializing;
  }

  private async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error("SQLite is only available on native platforms.");
    }
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.db = await this.sqlite.createConnection(
      DATABASE_NAME,
      false,
      "no-encryption",
      DATABASE_VERSION,
      false,
    );
    await this.db.open();
    await this.createRecordsTable();
    await this.createSettingsTable();
    await this.fillSettingsWithDefaultValues();
  }

  private async createRecordsTable(): Promise<void> {
    if (!this.db) return;
    await this.db.execute(createRecordsTableSql);
  }

  private async createSettingsTable(): Promise<void> {
    if (!this.db) return;
    await this.db.execute(createSettingsTableSql);
  }

  private async fillSettingsWithDefaultValues(): Promise<void> {
    if (!this.db) return;
    const defaults: {
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

    for (const setting of defaults) {
      const exists = await this.settingsValueExists(setting.key);
      if (!exists) {
        await this.db.run(
          "INSERT INTO settings (key, int_val, str_val) VALUES (?, ?, ?)",
          [setting.key, setting.intVal, setting.strVal],
        );
      }
    }
  }

  private async settingsValueExists(key: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.query(settingsValueExistsSql, [key]);
    return (result.values?.length ?? 0) > 0;
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

  async listRecords(year: number | null = null): Promise<Record[]> {
    await this.ensureReady();
    const result = year
      ? await this.db!.query(listRecordsByYearSql, [String(year)])
      : await this.db!.query(listRecordsSql);
    return (result.values ?? []).map((row) => this.rowToRecord(row));
  }

  async listRecordYears(): Promise<number[]> {
    await this.ensureReady();
    const result = await this.db!.query(listRecordYearsSql);
    return (result.values ?? [])
      .map((row) => Number(row.year))
      .filter((year) => Number.isFinite(year));
  }

  async getDatabaseUrl(): Promise<string> {
    await this.ensureReady();
    const result = await this.db!.getUrl();
    if (!result?.url) {
      throw new Error("Database URL not available");
    }
    return result.url;
  }

  async closeConnection(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
    if (this.sqlite) {
      await this.sqlite.closeConnection(DATABASE_NAME, false);
    }
    this.db = null;
    this.sqlite = null;
    this.initializing = null;
  }

  async getRecordById(id: number): Promise<Record | null> {
    await this.ensureReady();
    const result = await this.db!.query(getRecordByIdSql, [id]);
    const row = result.values?.[0];
    return row ? this.rowToRecord(row) : null;
  }

  async saveRecord(record: Record): Promise<number> {
    await this.ensureReady();
    const result = await this.db!.run(insertRecordSql, [
      record.name,
      record.type,
      record.subtype,
      toIsoString(record.dateAdded),
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
    ]);
    return result.changes?.lastId ?? -1;
  }

  async updateRecord(record: Record): Promise<void> {
    await this.ensureReady();
    await this.db!.run(updateRecordSql, [
      record.name,
      record.type,
      record.subtype,
      toIsoString(record.dateAdded),
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
    ]);
  }

  async deleteRecord(id: number): Promise<void> {
    await this.ensureReady();
    await this.db!.run(deleteRecordSql, [id]);
  }

  async setSettingsValue(
    key: string,
    intVal: number | null,
    strVal: string | null,
  ): Promise<void> {
    await this.ensureReady();
    const result = await this.db!.query(selectSettingIdSql, [key]);
    const row = result.values?.[0] as { id?: number } | undefined;
    if (row?.id) {
      await this.db!.run(updateSettingSql, [intVal, strVal, key]);
      return;
    }
    await this.db!.run(insertSettingSql, [key, intVal, strVal]);
  }

  async getSettingsValue(
    key: string,
  ): Promise<{ intVal: number | null; strVal: string } | null> {
    await this.ensureReady();
    const result = await this.db!.query(selectSettingsValueSql, [key]);
    const row = result.values?.[0] as
      | { int_val: number | null; str_val: string | null }
      | undefined;
    if (!row) return { intVal: -1, strVal: "" };
    return { intVal: row.int_val ?? -1, strVal: row.str_val ?? "" };
  }

  async exportDatabaseToJson(): Promise<{ path: string; data: string }> {
    await this.ensureReady();
    const json = await this.db!.exportToJson("full");
    const data = JSON.stringify(json);
    const fileName = `journalitea-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents,
    });
    return { path: uriResult.uri, data };
  }

  async importDatabaseFromJson(
    jsonString: string,
    mode: "append" | "replace",
  ): Promise<void> {
    await this.ensureReady();
    let json: any;
    try {
      json = JSON.parse(jsonString);
    } catch (error) {
      throw new Error("Selected file is not valid JSON.");
    }
    json.mode = mode === "append" ? "partial" : "full";

    if (mode === "replace") {
      await this.sqlite?.closeConnection(DATABASE_NAME, false);
      const sqliteAny = this.sqlite as any;
      if (sqliteAny?.deleteDatabase) {
        await sqliteAny.deleteDatabase(DATABASE_NAME);
      }
      this.db = null;
      this.initializing = null;
      await this.ensureReady();
    }

    const result = await this.sqlite?.importFromJson(json);
    if (!result?.changes || result.changes.changes < 0) {
      throw new Error("Import failed.");
    }
  }
}

export const capacitorDb = new CapacitorDatabaseService();

export const createRecordsTableSql = `
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
    preparation_method INTEGER,
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
    photo STRING
  )
`;

export const createSettingsTableSql = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    int_val INTEGER,
    str_val TEXT
  )
`;

export const listRecordsSql = "SELECT * FROM records ORDER BY date_added DESC";

export const listRecordsByYearSql =
  "SELECT * FROM records WHERE strftime('%Y', date_added) = ? ORDER BY date_added DESC";

export const listRecordYearsSql =
  "SELECT DISTINCT CAST(strftime('%Y', date_added) AS INTEGER) AS year FROM records WHERE date_added IS NOT NULL ORDER BY year DESC";

export const getRecordByIdSql = "SELECT * FROM records WHERE id = ?";

export const deleteRecordSql = "DELETE FROM records WHERE id = ?";

export const insertRecordSql = `
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
`;

export const updateRecordSql = `
  UPDATE records SET
    name = ?, type = ?, sub_type = ?, date_added = ?, seller = ?, origin = ?,
    year = ?, price = ?, price_currency = ?, weight = ?, weight_unit = ?,
    preparation_method = ?, preparation_notes = ?, dry_leaves = ?, wet_leaves = ?,
    liquor = ?, color = ?, aroma_sweet = ?, aroma_floral = ?, aroma_nutty = ?,
    aroma_spicy = ?, aroma_fire = ?, aroma_fruity = ?, aroma_plants = ?,
    aroma_earthy = ?, aroma_minerals = ?, aroma_marine = ?, notes = ?,
    rating = ?, photo = ?
  WHERE id = ?
`;

export const selectSettingIdSql = "SELECT id FROM settings WHERE key = ?";

export const selectSettingsValueSql =
  "SELECT int_val, str_val FROM settings WHERE key = ?";

export const insertSettingSql =
  "INSERT INTO settings (key, int_val, str_val) VALUES (?, ?, ?)";

export const updateSettingSql =
  "UPDATE settings SET int_val = ?, str_val = ? WHERE key = ?";

export const settingsValueExistsSql =
  "SELECT 1 FROM settings WHERE key = ? LIMIT 1";

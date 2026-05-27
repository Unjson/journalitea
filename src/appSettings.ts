export const APP_NAME = "Journalitea - Personal Tea Journal";
export const APP_VERSION = "1.0.0";
export const APP_USER_FOLDER = "User";
export const DATABASE_NAME = "database.db";
export const DEFAULT_LOCALE = "en";
export const PREFS = {
  CURRENCY: "main_currency",
  LANGUAGE: "language",
  WEIGHT_UNIT: "weight_unit",
  EXCHANGE_RATES: "exchange_rates",
  CUSTOM_CURRENCY: "custom_currency",
  HISTOGRAM_BUCKETS: "histogram_buckets",
};
export const DEFAULT_PREFS = {
  CURRENCY: 0, //USD
  LANGUAGE: 0, //ENGLISH
  WEIGHT_UNIT: 0, //METRIC_GRAM
  HISTOGRAM_BUCKETS: 17,
  CUSTOM_CURRENCY: {
    symbol: "",
    rate: 1.0,
  },
  EXCHANGE_RATES: {
    0: 1.0, //USD
    1: 0.9, //EUR
    2: 0.8, //GBP
    3: 7.0, //CNY
    4: 135.0, //JPY
    5: 85.0, //INR
    6: 8.0, //HKD
    7: 1.0, //OTHER
  },
  //Ho boy I sure hope there are no international incidents in the time
  // between me setting these defaults and later.
};

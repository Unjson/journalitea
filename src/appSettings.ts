export const APP_NAME = 'Journalitea - Personal Tea Journal';
export const APP_VERSION = '1.0.0';
export const APP_USER_FOLDER = 'User'
export const DATABASE_NAME = 'database.db';
export const DEFAULT_LOCALE = 'en';
export const PREFS = {
	CURRENCY: "main_currency",
	LANGUAGE: "language",
	WEIGHT_UNIT: "weight_unit",
	EXCHANGE_RATES: "exchange_rates"
}
export const DEFAULT_PREFS = {
	CURRENCY: 0, //USD
	LANGUAGE: 0, //ENGLISH
	WEIGHT_UNIT: 0, //METRIC_GRAM
	EXCHANGE_RATES: {
		0: 1.0, //USD
		1: 0.90, //EUR
		2: 0.8, //GBP
		3: 7, //CNY
		4: 135, //JPY
		5: 85, //INR
		6: 8, //HKD
		7: 1.0 //OTHER
	} 
	//Ho boy I sure hope there are no international incidents in the time 
	// between me setting these defaults and later.
}
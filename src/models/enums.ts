
export enum Page{
	RECORDS_LIST = 0,
	ABOUT = 1,
	RECORD_DETAIL = 2,
	EDIT_RECORD = 3,
	NEW_RECORD = 4,
	SETTINGS = 5,
	STATS = 6
}

export enum TeaType
{
	GREEN = 0,
	BLACK = 1,
	OOLONG = 2,
	WHITE = 3, 
	DARK = 4,
	YELLOW = 5,
	// 6 not used atm (used to be PURPLE)	
	HERBAL = 7,
	OTHER = 8
}

export enum PreparationMethod{
	WESTERN = 0,
	GAIWAN = 1,
	CLAY = 2,
	TEABAG = 3,
	COLDBREW = 4,
	OTHER = 5
}

export enum CurrencyType
{
	USD = 0,
	EUR = 1,
	GBP = 2,
	CNY = 3,
	JPY = 4,
	INR = 5,
	HKD = 6,
	OTHER = 7
}

export enum WeightUnit {	
	METRIC_GRAM = 0,
	IMPERIAL_OUNCE = 1
}

export enum Language{
	ENGLISH = 0,
	GERMAN = 1
}

export function getLocaleFromLanguage(lang: Language): string {
	switch(lang){
		case Language.ENGLISH:
			return "en";
		case Language.GERMAN:
			return "de";
		default:		
		return "en";
	}
}
export function getCurrencySymbols(): Record<CurrencyType, string> {
	return {
		[CurrencyType.USD]: "$",
		[CurrencyType.EUR]: "€",
		[CurrencyType.GBP]: "£",
		[CurrencyType.CNY]: "¥",
		[CurrencyType.JPY]: "¥",
		[CurrencyType.INR]: "₹",
		[CurrencyType.HKD]: "HK$",
		[CurrencyType.OTHER]: ""
	}
}

export function getTeaTypeNames(): Record<TeaType, string> {
	return {
		[TeaType.GREEN]: "enum.type_green",
		[TeaType.BLACK]: "enum.type_black",
		[TeaType.OOLONG]: "enum.type_oolong",
		[TeaType.WHITE]: "enum.type_white",
		[TeaType.DARK]: "enum.type_dark",
		[TeaType.YELLOW]: "enum.type_yellow",
		[TeaType.HERBAL]: "enum.type_herbal",
		[TeaType.OTHER]: "enum.type_other"
	}
}

export function getWeightUnitNames(): Record<WeightUnit, string> {
	return {
		[WeightUnit.METRIC_GRAM]: "g",
		[WeightUnit.IMPERIAL_OUNCE]: "oz"
	}
}

export function getExchangeRateRecordFromJSONResponse(json: object): Record<CurrencyType, number> {
	var exchangeRates: Record<CurrencyType, number> = {
		[CurrencyType.USD]: 0,
		[CurrencyType.EUR]: 0,
		[CurrencyType.GBP]: 0,
		[CurrencyType.CNY]: 0,
		[CurrencyType.JPY]: 0,
		[CurrencyType.INR]: 0,
		[CurrencyType.HKD]: 0,
		[CurrencyType.OTHER]: 0
	};
	
	const jsonObj = json as any;
	for (const key in jsonObj.rates) {
		switch(key){
			case "USD":
				exchangeRates[CurrencyType.USD] = jsonObj.rates[key];
				break;
			case "EUR":
				exchangeRates[CurrencyType.EUR] = jsonObj.rates[key];
				break;
			case "GBP":
				exchangeRates[CurrencyType.GBP] = jsonObj.rates[key];
			case "CNY":
				exchangeRates[CurrencyType.CNY] = jsonObj.rates[key];
				break;
			case "JPY":
				exchangeRates[CurrencyType.JPY] = jsonObj.rates[key];
				break;
			case "INR":
				exchangeRates[CurrencyType.INR] = jsonObj.rates[key];
				break;
			case "HKD":
				exchangeRates[CurrencyType.HKD] = jsonObj.rates[key];
				break;
			default:
				break;
		}
	}
	return exchangeRates;
}
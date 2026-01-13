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
	TWD = 6,
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
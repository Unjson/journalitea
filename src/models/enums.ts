
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

export enum TeaAromas{
	SWEET = 'aroma_sweet',
	FLORAL = 'aroma_floral',
	NUTTY = 'aroma_nutty',
	SPICY = 'aroma_spicy',
	FIRE = 'aroma_fire',
	FRUITY = 'aroma_fruity',
	PLANTS = 'aroma_plants',
	EARTHY = 'aroma_earthy',
	MINERALS = 'aroma_minerals',
	MARINE = 'aroma_marine'
}

export enum PreparationMethod{
	WESTERN = 0,
	GAIWAN = 1,
	TEAPOT = 2,
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

export function getExchangeRateRecordFromJSONResponse(json: object): Record<CurrencyType, number> {
	var exchangeRates: Record<CurrencyType, number> = {
		[CurrencyType.USD]: 0,
		[CurrencyType.EUR]: 0,
		[CurrencyType.GBP]: 0,
		[CurrencyType.CNY]: 0,
		[CurrencyType.JPY]: 0,
		[CurrencyType.INR]: 0,
		[CurrencyType.HKD]: 0,
		[CurrencyType.OTHER]: 1
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

export const aromaFieldLabels = [
  { key: TeaAromas.SWEET, label: 'enum.aromas_sweet' },
  { key: TeaAromas.FLORAL, label: 'enum.aromas_floral' },
  { key: TeaAromas.NUTTY, label: 'enum.aromas_nutty' },
  { key: TeaAromas.SPICY, label: 'enum.aromas_spicy' },
  { key: TeaAromas.FIRE, label: 'enum.aromas_fire' },
  { key: TeaAromas.FRUITY, label: 'enum.aromas_fruity' },
  { key: TeaAromas.PLANTS, label: 'enum.aromas_vegetal' },
  { key: TeaAromas.EARTHY, label: 'enum.aromas_earthy' },
  { key: TeaAromas.MINERALS, label: 'enum.aromas_minerals' },
  { key: TeaAromas.MARINE, label: 'enum.aromas_marine' },
] as const;

export const teaTypeLabels = [
  { value: TeaType.GREEN, label: 'enum.type_green' },
  { value: TeaType.BLACK, label: 'enum.type_black' },
  { value: TeaType.OOLONG, label: 'enum.type_oolong' },
  { value: TeaType.WHITE, label: 'enum.type_white' },
  { value: TeaType.DARK, label: 'enum.type_dark' },
  { value: TeaType.YELLOW, label: 'enum.type_yellow' },
  { value: TeaType.HERBAL, label: 'enum.type_herbal' },
  { value: TeaType.OTHER, label: 'enum.type_other' },
];

export const weightUnitLabels = [
  { value: WeightUnit.METRIC_GRAM, label: 'enum.weightunit_g' },
  { value: WeightUnit.IMPERIAL_OUNCE, label: 'enum.weightunit_oz' },
];

export const weightUnitSymbols = [	
	{	value: WeightUnit.METRIC_GRAM, symbol: "g"},
	{	value: WeightUnit.IMPERIAL_OUNCE, symbol: "oz"}
]

export const preparationMethodLabels = [
  { value: PreparationMethod.WESTERN, label: 'enum.preparation_western' },
  { value: PreparationMethod.GAIWAN, label: 'enum.preparation_gaiwan' },
  { value: PreparationMethod.TEAPOT, label: 'enum.preparation_teapot' },
  { value: PreparationMethod.TEABAG, label: 'enum.preparation_teabag' },
  { value: PreparationMethod.COLDBREW, label: 'enum.preparation_coldbrew' },
   { value: PreparationMethod.OTHER, label: 'enum.preparation_other' },
];


export const currencyLabels = [
  { value: CurrencyType.USD, label: 'enum.currency_usd' },
  { value: CurrencyType.EUR, label: 'enum.currency_eur' },
  { value: CurrencyType.GBP, label: 'enum.currency_gbp' },
  { value: CurrencyType.CNY, label: 'enum.currency_cny' },
  { value: CurrencyType.JPY, label: 'enum.currency_jpy' },
  { value: CurrencyType.INR, label: 'enum.currency_inr' },
  { value: CurrencyType.HKD, label: 'enum.currency_hkd' },
  { value: CurrencyType.OTHER, label: 'enum.currency_other' },
];

export const currencySymbols = [
	  { value: CurrencyType.USD, symbol: "$" },
	  { value: CurrencyType.EUR, symbol: "€" },
	  { value: CurrencyType.GBP, symbol: "£" },
	  { value: CurrencyType.CNY, symbol: "¥" },
	  { value: CurrencyType.JPY, symbol: "¥" },
	  { value: CurrencyType.INR, symbol: "₹" },
	  { value: CurrencyType.HKD, symbol: "HK$" },
	  { value: CurrencyType.OTHER, symbol: "" }
]
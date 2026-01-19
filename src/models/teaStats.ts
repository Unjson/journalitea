import { Record as TeaRecord } from './record';
import { TeaType, CurrencyType, WeightUnit } from './enums';
import { get } from 'node:http';

export const OZ_IN_G = 0.03527396;
const exchangeRateApi = 'https://api.frankfurter.dev/v1/latest'

export function getCumulativeStats(
	records: TeaRecord[], 
	mainCurrency: CurrencyType, 
	preferredWeightUnit: WeightUnit,
	exchangeRates: object
): {
    totalMoneySpent: number;
    totalWeight: number;
    pricePerWeight: number;
    mostExpensiveTea: TeaRecord | null;
    teaCountByType:  Record<TeaType, number>;
  } {

	let totalMoneySpent = 0.0;
	let totalWeight = 0.0;
	let mostExpensiveTea: TeaRecord | null = null;
	let mostexpensivePrice = 0.0;
	const teaCountByType: Record<TeaType, number> = {
		[TeaType.GREEN]: 0,
		[TeaType.BLACK]: 0,
		[TeaType.OOLONG]: 0,
		[TeaType.WHITE]: 0,
		[TeaType.DARK]: 0,
		[TeaType.YELLOW]: 0,
		[TeaType.HERBAL]: 0,
		[TeaType.OTHER]: 0
	};
	for (const record of records) {
		const priceInMainCurrency = getPriceInMainCurrency(
			record.price, 
			record.priceCurrency, 
			mainCurrency, 
			exchangeRates
		);
		totalMoneySpent += priceInMainCurrency;
		if(priceInMainCurrency > mostexpensivePrice){
			mostexpensivePrice = priceInMainCurrency;
			mostExpensiveTea = record;
		}
		const weightInDesiredUnit = getWeightInDesiredUnit(record, preferredWeightUnit);
		totalWeight += weightInDesiredUnit;
		teaCountByType[record.type] += 1;
	}
		
	return {
			totalMoneySpent: totalMoneySpent,
			totalWeight: totalWeight,
			pricePerWeight: totalWeight > 0 ? totalMoneySpent / totalWeight : 0.0,
			mostExpensiveTea: mostExpensiveTea,
			teaCountByType: teaCountByType
		};
	}
  

  export async function lookUpExchangeRates(mainCurrency: CurrencyType) : Promise<Record<CurrencyType, number>> {
	const keys = Object.keys(CurrencyType).filter(k => k !== 'OTHER' && isNaN(Number(k)));
	const requestUrl = `${exchangeRateApi}?base=${keys[mainCurrency]}&symbols=${keys.join(',')}`;
	

	var exchangeRates: Record<CurrencyType, number> = {
		[CurrencyType.USD]: 0,
		[CurrencyType.EUR]: 0,
		[CurrencyType.GBP]: 0,
		[CurrencyType.CNY]: 0,
		[CurrencyType.JPY]: 0,
		[CurrencyType.INR]: 0,
		[CurrencyType.TWD]: 0,
		[CurrencyType.OTHER]: -1
	} ;

	const response = await fetch(requestUrl)
	const data = await response.json();
	
	for (const key of keys) {
		const currencyType = CurrencyType[key as keyof typeof CurrencyType];
		if (currencyType !== mainCurrency && data.rates[key] !== undefined) {
			exchangeRates[currencyType] = data.rates[key];
		} else if (currencyType === mainCurrency) {
			exchangeRates[currencyType] = 1.0;
		}
	}

	return exchangeRates;
  }
  


  export function getPriceInMainCurrency(price: number, priceCurrency: CurrencyType, mainCurrency: CurrencyType, exchangeRates: object): number {
	if (priceCurrency !== mainCurrency) {
		return price / exchangeRates[String(priceCurrency)];
	}
	return price;
  }

  export function convertToPricePerDesiredUnit(
	price: number, 
	weight: number, 
	weightUnit: WeightUnit, 
	desiredUnit: WeightUnit, 
	priceCurrency: CurrencyType, 
	mainCurrency: CurrencyType, 
	exchangeRates: object): number {
		
	var priceInMainCurrency: number = getPriceInMainCurrency(price, priceCurrency, mainCurrency, exchangeRates);
	if (weight === 0.0 || price === 0.0) {
		return 0.0;
	}
	if (weightUnit === desiredUnit) {
		return priceInMainCurrency / weight;
	} else if (weightUnit === WeightUnit.METRIC_GRAM && desiredUnit === WeightUnit.IMPERIAL_OUNCE) {
		return (priceInMainCurrency / weight) * OZ_IN_G;
	} else if (weightUnit === WeightUnit.IMPERIAL_OUNCE && desiredUnit === WeightUnit.METRIC_GRAM) {
		return (priceInMainCurrency / weight) / OZ_IN_G;
	}
	return 0.0;
  }

function getWeightInDesiredUnit(record: TeaRecord, desiredUnit: WeightUnit): number {
	if (record.weightUnit === desiredUnit) {
		return record.weight;
	} else if (record.weightUnit === WeightUnit.METRIC_GRAM && desiredUnit === WeightUnit.IMPERIAL_OUNCE) {
		return record.weight * OZ_IN_G;
	} else if (record.weightUnit === WeightUnit.IMPERIAL_OUNCE && desiredUnit === WeightUnit.METRIC_GRAM) {
		return record.weight / OZ_IN_G;
	}
	return 0.0;
}
import { Record as TeaRecord } from './record';
import { TeaType, CurrencyType, WeightUnit } from './enums';

export const OZ_IN_G = 0.03527396;
const exchangeRateApi = 'https://api.frankfurter.dev/v1/latest'

export function getCumulativeStats(records: TeaRecord[]): {
    totalMoneySpent: { [currency: string]: number };
    totalWeight: { [unit: string]: number };
    pricePerWeight: { [key: string]: number };
    mostExpensiveTea: TeaRecord | null;
    teaCountByType: { [type: string]: number };
  } {
    
    // Initialize stats
    const totalMoneySpent: { [currency: string]: number } = {};
    const totalWeight: { [unit: string]: number } = {};
    const teaCountByType: { [type: string]: number } = {};
    let mostExpensiveTea: TeaRecord | null = null;
    let maxPrice = 0;

    // Calculate stats
    for (const record of records) {
      // Total money spent by currency
      if (record.price && record.price > 0) {
        const currency = record.price_currency?.toString() || 'unknown';
        totalMoneySpent[currency] = (totalMoneySpent[currency] || 0) + record.price;
        
        // Track most expensive tea
        if (record.price > maxPrice) {
          maxPrice = record.price;
          mostExpensiveTea = record;
        }
      }

      // Total weight by unit
      if (record.weight && record.weight > 0) {
        const unit = record.weightUnit?.toString() || 'unknown';
        totalWeight[unit] = (totalWeight[unit] || 0) + record.weight;
      }

      // Count by tea type
      const type = record.type?.toString() || 'unknown';
      teaCountByType[type] = (teaCountByType[type] || 0) + 1;
    }

    // Calculate price per weight for each currency/unit combination
    const pricePerWeight: { [key: string]: number } = {};
    for (const currency in totalMoneySpent) {
      for (const unit in totalWeight) {
        const key = `${currency}_per_${unit}`;
        pricePerWeight[key] = totalMoneySpent[currency] / totalWeight[unit];
      }
    }

    return {
      totalMoneySpent,
      totalWeight,
      pricePerWeight,
      mostExpensiveTea,
      teaCountByType
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
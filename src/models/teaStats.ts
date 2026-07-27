import { Record as TeaRecord } from "./record";
import {
  TeaType,
  CurrencyType,
  WeightUnit,
  currencySymbols,
  getExchangeRateRecordFromJSONResponse,
} from "./enums";
import { get } from "node:http";

export const OZ_IN_G = 28.34952;
const exchangeRateApi = "https://api.frankfurter.dev/v1/latest";

export function getCumulativeStats(
  records: TeaRecord[],
  mainCurrency: CurrencyType,
  preferredWeightUnit: WeightUnit,
  exchangeRates: Record<CurrencyType, number>,
): {
  totalMoneySpent: number;
  totalWeight: number;
  pricePerWeight: number;
  mostExpensiveTea: TeaRecord | null;
  mostExpensivePerWeightTea: TeaRecord | null;
  teaCountByType: Record<TeaType, number>;
  teaWeightByType: Record<TeaType, number>;
  teaSpendingByType: Record<TeaType, number>;
} {
  let totalMoneySpent = 0.0;
  let totalWeight = 0.0;
  let mostExpensiveTea: TeaRecord | null = null;
  let mostExpensivePerWeightTea: TeaRecord | null = null;
  let highestPricePerWeight = 0.0;
  let mostexpensivePrice = 0.0;
  const teaCountByType: Record<TeaType, number> = {
    [TeaType.GREEN]: 0,
    [TeaType.BLACK]: 0,
    [TeaType.OOLONG]: 0,
    [TeaType.WHITE]: 0,
    [TeaType.DARK]: 0,
    [TeaType.YELLOW]: 0,
    [TeaType.PUER]: 0,
    [TeaType.HERBAL]: 0,
    [TeaType.OTHER]: 0,
  };
  const teaWeightByType: Record<TeaType, number> = {
    [TeaType.GREEN]: 0,
    [TeaType.BLACK]: 0,
    [TeaType.OOLONG]: 0,
    [TeaType.WHITE]: 0,
    [TeaType.DARK]: 0,
    [TeaType.YELLOW]: 0,
    [TeaType.PUER]: 0,
    [TeaType.HERBAL]: 0,
    [TeaType.OTHER]: 0,
  };
  const teaSpendingByType: Record<TeaType, number> = {
    [TeaType.GREEN]: 0,
    [TeaType.BLACK]: 0,
    [TeaType.OOLONG]: 0,
    [TeaType.WHITE]: 0,
    [TeaType.DARK]: 0,
    [TeaType.YELLOW]: 0,
    [TeaType.PUER]: 0,
    [TeaType.HERBAL]: 0,
    [TeaType.OTHER]: 0,
  };
  for (const record of records) {
    const priceInMainCurrency = getPriceInMainCurrency(
      record.price,
      record.priceCurrency,
      mainCurrency,
      exchangeRates,
    );
    const pricePerWeight = convertToPricePerDesiredUnit(
      record.price,
      record.weight,
      record.weightUnit,
      preferredWeightUnit,
      record.priceCurrency,
      mainCurrency,
      exchangeRates,
    );
    if (pricePerWeight > highestPricePerWeight) {
      highestPricePerWeight = pricePerWeight;
      mostExpensivePerWeightTea = record;
    }
    totalMoneySpent += priceInMainCurrency;
    if (priceInMainCurrency > mostexpensivePrice) {
      mostexpensivePrice = priceInMainCurrency;
      mostExpensiveTea = record;
    }
    const weightInDesiredUnit = getWeightInDesiredUnit(
      record,
      preferredWeightUnit,
    );
    totalWeight += weightInDesiredUnit;
    teaCountByType[record.type] += 1;
    teaWeightByType[record.type] += weightInDesiredUnit;
    teaSpendingByType[record.type] += priceInMainCurrency;
  }

  return {
    totalMoneySpent: totalMoneySpent,
    totalWeight: totalWeight,
    pricePerWeight: totalWeight > 0 ? totalMoneySpent / totalWeight : 0.0,
    mostExpensiveTea: mostExpensiveTea,
    mostExpensivePerWeightTea: mostExpensivePerWeightTea,
    teaCountByType: teaCountByType,
    teaWeightByType: teaWeightByType,
    teaSpendingByType: teaSpendingByType,
  };
}

export async function lookUpExchangeRates(
  mainCurrency: CurrencyType,
): Promise<Record<CurrencyType, number>> {
  const keys = Object.keys(CurrencyType).filter(
    (k) => k !== "OTHER" && isNaN(Number(k)),
  );
  const requestUrl = `${exchangeRateApi}?base=${keys[mainCurrency]}&symbols=${keys.join(",")}`;
  const response = await fetch(requestUrl);
  const data = await response.json();

  return getExchangeRateRecordFromJSONResponse(data as object);
}

export function getPriceInMainCurrency(
  price: number,
  priceCurrency: CurrencyType,
  mainCurrency: CurrencyType,
  exchangeRates: Record<string, number>,
): number {
  if (!price || isNaN(price)) {
    return 0.0;
  }
  if (priceCurrency !== mainCurrency) {
    const rate = exchangeRates?.[String(priceCurrency)];
    if (!rate || isNaN(rate) || rate === 0) {
      return price;
    }
    return price / rate;
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
  exchangeRates: Record<string, number>,
): number {
  var priceInMainCurrency: number = getPriceInMainCurrency(
    price,
    priceCurrency,
    mainCurrency,
    exchangeRates,
  );
  if (weight === 0.0 || price === 0.0) {
    return 0.0;
  }
  if (weightUnit === desiredUnit) {
    return priceInMainCurrency / weight;
  } else if (
    weightUnit === WeightUnit.METRIC_GRAM &&
    desiredUnit === WeightUnit.IMPERIAL_OUNCE
  ) {
    return (priceInMainCurrency / weight) * OZ_IN_G;
  } else if (
    weightUnit === WeightUnit.IMPERIAL_OUNCE &&
    desiredUnit === WeightUnit.METRIC_GRAM
  ) {
    return priceInMainCurrency / weight / OZ_IN_G;
  }
  return 0.0;
}

function getWeightInDesiredUnit(
  record: TeaRecord,
  desiredUnit: WeightUnit,
): number {
  if (record.weightUnit === desiredUnit) {
    return record.weight;
  } else if (
    record.weightUnit === WeightUnit.METRIC_GRAM &&
    desiredUnit === WeightUnit.IMPERIAL_OUNCE
  ) {
    return record.weight / OZ_IN_G;
  } else if (
    record.weightUnit === WeightUnit.IMPERIAL_OUNCE &&
    desiredUnit === WeightUnit.METRIC_GRAM
  ) {
    return record.weight * OZ_IN_G;
  }
  return 0.0;
}

export function formatPriceString(
  price: number,
  priceCurrency: CurrencyType,
): string {
  const currencySymbol = currencySymbols[priceCurrency].symbol;
  if (priceCurrency === CurrencyType.EUR) {
    return `${price.toFixed(2)}${currencySymbol}`;
  } else {
    return `${currencySymbol}${price.toFixed(2)}`;
  }
}

import { TeaType, PreparationMethod, CurrencyType, WeightUnit } from './enums.js';

export class Record {
	//Data Block
	id: number;
	name: string;
	type: TeaType;
	subtype: string;
	dateAdded: Date;
	seller: string;
	origin: string
	year: number;
	price: number;
	priceCurrency: CurrencyType;
	weight: number;
	weightUnit: WeightUnit
	preparationMethod: PreparationMethod;
	preparationNotes: string;

	//Tasting Notes Block
	dryLeaves: string;
	wetLeaves: string;
	liquor: string;
	color: number;

	//ITMC Scale Ratings
	aroma_sweet: number;
	aroma_floral: number
	aroma_nutty: number;
	aroma_spicy: number;
	aroma_fire: number;
	aroma_fruity: number;
	aroma_plants: number;
	aroma_earthy: number
	aroma_minerals: number;
	aroma_marine: number;

	//Various/Notes
	notes: string;
	rating: number;
	photo: Blob | null;

	constructor() {
		this.id = -1;
		this.name = "";
		this.type = TeaType.GREEN;
		this.subtype = "";
		this.dateAdded = new Date(Date.now());
		this.seller = "";
		this.origin = "";
		this.year = new Date().getFullYear();
		this.price = 0;
		this.priceCurrency = CurrencyType.OTHER;
		this.weight = 0;
		this.weightUnit = WeightUnit.METRIC_GRAM;
		this.preparationMethod = PreparationMethod.GAIWAN;
		this.preparationNotes = "";

		this.dryLeaves = "";
		this.wetLeaves = "";
		this.liquor = "";
		this.color = 0;

		this.aroma_sweet = 0;
		this.aroma_floral = 0;
		this.aroma_nutty = 0;
		this.aroma_spicy = 0;
		this.aroma_fire = 0;
		this.aroma_fruity = 0;
		this.aroma_plants = 0;
		this.aroma_earthy = 0;
		this.aroma_minerals = 0;
		this.aroma_marine = 0;
		this.notes = "";
		this.rating = 0;
		this.photo = null;
	}

	getTypeName(): string {
		return TeaType[this.type];
	}

	getPreparationMethodName(): string {
		return PreparationMethod[Number(this.preparationMethod)];
	}

	getCurrencyName(): string {
		return CurrencyType[this.priceCurrency];
	}

	convertToPlainObject(): any {
		return {
			id: this.id,
			name: this.name,
			type: this.type,
			subtype: this.subtype,
			dateAdded: this.dateAdded,
			seller: this.seller,
			origin: this.origin,
			year: this.year,
			price: this.price,
			priceCurrency: this.priceCurrency,
			weight: this.weight,
			weightUnit: this.weightUnit,
			preparationMethod: this.preparationMethod,
			preparationNotes: this.preparationNotes,
			dryLeaves: this.dryLeaves,
			wetLeaves: this.wetLeaves,
			liquor: this.liquor,
			color: this.color,
			aroma_sweet: this.aroma_sweet,
			aroma_floral: this.aroma_floral,
			aroma_nutty: this.aroma_nutty,
			aroma_spicy: this.aroma_spicy,
			aroma_fire: this.aroma_fire,
			aroma_fruity: this.aroma_fruity,
			aroma_plants: this.aroma_plants,
			aroma_earthy: this.aroma_earthy,
			aroma_minerals: this.aroma_minerals,
			aroma_marine: this.aroma_marine,
			notes: this.notes,
			rating: this.rating,
			photo: this.photo,
		};
	}

	getPriceStringWithCurrency(): string {
		const currencySymbol = this.getCurrencySymbol();
		if(this.priceCurrency=== CurrencyType.EUR){
			return `${this.price.toFixed(2)}${currencySymbol}`;
		}
		else{
			return `${currencySymbol}${this.price.toFixed(2)}`;
		}
	}
	
	getCurrencySymbol(): string {	
		switch (this.priceCurrency) {
			case CurrencyType.USD:
				return "$";
			case CurrencyType.EUR:
				return "€";
			case CurrencyType.GBP:
				return "£";
			case CurrencyType.CNY:
				return "¥";
			case CurrencyType.JPY:
				return "¥";
			case CurrencyType.INR:
				return "₹";
			case CurrencyType.HKD:
				return "NT$";
			default:
				return "";
		}
	}
}

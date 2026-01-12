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
	price_currency: CurrencyType;
	weight: number;
	weightUnit: WeightUnit
	preparationMethod: string;
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
		this.type = TeaType.OTHER;
		this.subtype = "";
		this.dateAdded = new Date(Date.now());
		this.seller = "";
		this.origin = "";
		this.year = new Date().getFullYear();
		this.price = 0;
		this.price_currency = CurrencyType.OTHER;
		this.weight = 0;
		this.weightUnit = WeightUnit.METRIC_GRAM;
		this.preparationMethod = "";
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

	/**
	 * Converts the photo Blob to a displayable image URL
	 * @returns Promise<string | null> - Data URL for the image or null if no photo
	 */
	async getPhotoUrl(): Promise<string | null> {
		if (!this.photo) {
			return null;
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(this.photo);
		});
	}

	getTypeName(): string {
		return TeaType[this.type];
	}

	getPreparationMethodName(): string {
		return PreparationMethod[Number(this.preparationMethod)];
	}

	getCurrencyName(): string {
		return CurrencyType[this.price_currency];
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
			price_currency: this.price_currency,
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
		if(this.price_currency=== CurrencyType.EUR){
			return `${this.price.toFixed(2)}${currencySymbol}`;
		}
		else{
			return `${currencySymbol}${this.price.toFixed(2)}`;
		}
	}
	
	getCurrencySymbol(): string {	
		switch (this.price_currency) {
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
			case CurrencyType.TWD:
				return "NT$";
			default:
				return "";
		}
	}
}

enum TeaType
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

enum PreparationMethod{
	WESTERN = 0,
	GAIWAN = 1,
	CLAY = 2,
	TEABAG = 3,
	COLDBREW = 4,
	OTHER = 5
}

enum CurrencyType
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

enum WeightUnit {
	METRIC_GRAM = 0,
	IMPERIAL_OUNCE = 1
}

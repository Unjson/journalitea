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
	currency: CurrencyType;
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
	aroma_firey: number;
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
		this.currency = CurrencyType.OTHER;
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
		this.aroma_firey = 0;
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
		return CurrencyType[this.currency];
	}



}

enum TeaType
{
	GREEN,
	BLACK,
	OOLONG,
	WHITE, 
	DARK,
	YELLOW,	
	HERBAL,
	OTHER
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
	USD,
	EUR,
	GBP,
	CNY,
	JPY,
	INR,
	TWD,
	OTHER
}

enum WeightUnit {
	METRIC_GRAM,
	IMPERIAL_OUNCE
}

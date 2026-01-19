import { TeaType } from "./enums";

export const TeaColors: Record<TeaType, string> = {
	[TeaType.GREEN]: "#A8D5BA",
	[TeaType.BLACK]: "#C04547",
	[TeaType.OOLONG]: "#7BAFF4",
	[TeaType.WHITE]: "#EDEDCF",
	[TeaType.DARK]: "#4B3621",
	[TeaType.YELLOW]: "#FFEB99",
	[TeaType.HERBAL]: "#D8BFD8",
	[TeaType.OTHER]: "#D3D3D3"
};
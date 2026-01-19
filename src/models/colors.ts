import { TeaType } from "./enums";
import { Gradient } from "typescript-color-gradient"

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

export const teaColorGradient = new Gradient()
.setGradient("#e2f9db", "#e9446a", "#c8eba8", "#c2ca4c", "#edcb7a", "#e78747", "#8f4116", "#463c28")
.setNumberOfColors(256);

export function getColorForRating(rating: number): string {
	const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
	const colorIndex = Math.round(clamp(rating) * 255)
	return teaColorGradient.getColor(colorIndex) || "#000000";
}

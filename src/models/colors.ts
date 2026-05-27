import { TeaType } from "./enums";

export const TeaColors: Record<TeaType, string> = {
  [TeaType.GREEN]: "#A8D5BA",
  [TeaType.BLACK]: "#C04547",
  [TeaType.OOLONG]: "#7BAFF4",
  [TeaType.WHITE]: "#EDEDCF",
  [TeaType.DARK]: "#4B3621",
  [TeaType.YELLOW]: "#FFEB99",
  [TeaType.PUER]: "#BF892A",
  [TeaType.HERBAL]: "#D8BFD8",
  [TeaType.OTHER]: "#D3D3D3",
};

export const TeaGradientStops = [
	"#e2f9db",
	"#c8eba8",
	"#c2ca4c",
	"#edcb7a",
	"#e78747",
	"#8f4116",
	"#463c28"
];

export const teaColorGradientCss = `linear-gradient(90deg, ${TeaGradientStops.join(", ")})`;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export function getColorForRating(rating: number): string {
  const safeRating = clamp(rating);
  const maxIndex = TeaGradientStops.length - 1;
  if (maxIndex <= 0) return TeaGradientStops[0] || "#000000";

  const scaled = safeRating * maxIndex;
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(lowerIndex + 1, maxIndex);
  const t = scaled - lowerIndex;

  const start = hexToRgb(TeaGradientStops[lowerIndex]);
  const end = hexToRgb(TeaGradientStops[upperIndex]);
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);

  return rgbToHex(r, g, b);
}

import fs from "fs";
import { parseTranslationsFromCSVContent } from "./csvParser.js";

export function parseTranslationsFromCSVFile(
  csvPath: string,
): Record<string, any> {
  const content = fs.readFileSync(csvPath, "utf-8");
  return parseTranslationsFromCSVContent(content);
}

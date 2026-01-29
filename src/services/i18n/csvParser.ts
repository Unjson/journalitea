export function parseTranslationsFromCSVContent(
  content: string,
): Record<string, any> {
  const lines = content.split("\n");
  const headers = lines[0].split(";").map((h) => h.trim());

  const translations: Record<string, any> = {};

  // Initialize language objects
  headers.slice(1).forEach((lang) => {
    translations[lang] = {};
  });

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(";").map((c) => c.trim());
    const key = cells[0];

    if (!key) continue;

    // Set nested keys (e.g., "record.name" -> { record: { name: "..." } })
    headers.slice(1).forEach((lang, idx) => {
      const value = cells[idx + 1] || "";
      setNestedValue(translations[lang], key, value);
    });
  }

  return translations;
}

export function parseTranslationsFromCSV(csvPath: string): Record<string, any> {
  throw new Error(
    "parseTranslationsFromCSV is not available in browser builds. Use parseTranslationsFromCSVContent instead.",
  );
}

function setNestedValue(obj: any, path: string, value: string) {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

import * as fs from 'fs';
import * as path from 'path';

export function parseTranslationsFromCSV(csvPath: string): Record<string, any> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  
  const translations: Record<string, any> = {};
  
  // Initialize language objects
  headers.slice(1).forEach(lang => {
    translations[lang] = {};
  });
  
  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';').map(c => c.trim());
    const key = cells[0];
    
    if (!key) continue;
    
    // Set nested keys (e.g., "record.name" -> { record: { name: "..." } })
    headers.slice(1).forEach((lang, idx) => {
      const value = cells[idx + 1] || '';
      setNestedValue(translations[lang], key, value);
    });
  }
  
  return translations;
}

function setNestedValue(obj: any, path: string, value: string) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}
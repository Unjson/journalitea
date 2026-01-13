import { createI18n } from 'vue-i18n';
import { parseTranslationsFromCSV } from './csvParser';
import * as path from 'path';

const electron = (window as any).require('electron');
const { ipcRenderer } = electron;

// Load translations from CSV via IPC
const messages = await ipcRenderer.invoke('i18n:loadTranslations');

const i18n = createI18n({
  legacy: false,
  locale: 'en', // default locale
  fallbackLocale: 'en',
  messages,
});

export default i18n;
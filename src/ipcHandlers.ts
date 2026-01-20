import { app, ipcMain } from 'electron';
import path from 'node:path';
import db from './services/database.js';
import { parseTranslationsFromCSV } from './services/i18n/csvParser.js';

// Setup IPC handlers for database operations
export const setupIpcHandlers = (): void => {
  ipcMain.handle('db:listRecords', async () => {
    try {
      return db.listRecords();
    } catch (error) {
      console.error('Error listing records:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getRecordById', async (event, id: number) => {
    try {
      return db.getRecordById(id);
    } catch (error) {
      console.error('Error getting record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:saveRecord', async (event, record) => {
    try {
      return db.saveRecord(record);
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateRecord', async (event, record) => {
    try {
      return db.updateRecord(record);
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteRecord', async (event, id: number) => {
    try {
      return db.deleteRecord(id);
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getSetting', async (event, key: string) => {
    try {
      return db.getSettingsValue(key);
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setSetting', async (event, key: string, intValue: number | null, strValue: string | null) => {
    try {
      return db.setSetingsValue(key, intValue, strValue);
    } catch (error) {
      console.error('Error setting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('i18n:loadTranslations', async () => {
    try {
      const csvPath = path.join(app.getAppPath(), 'src', 'services', 'i18n', 'translations.csv');
      const translations = parseTranslationsFromCSV(csvPath);
      return translations;
    } catch (error) {
      console.error('Error loading translations:', error);
      throw error;
    }
  });
};

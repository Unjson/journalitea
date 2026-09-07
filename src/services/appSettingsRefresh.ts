import { PREFS } from "../appSettings";
import { getLocaleFromLanguage, setCustomCurrency } from "../models/enums";
import i18n from "./i18n";
import { platformBridge } from "./platformBridge";

/**
 * Re-reads app-level settings from the database and applies them to the
 * running app (locale, custom currency). Call this after the local database
 * has been replaced or overwritten, e.g. after restoring a synced database,
 * so the app actually uses the settings stored in the synced database
 * instead of the ones loaded at startup.
 */
export const refreshAppSettings = async (): Promise<void> => {
  try {
    const language = await platformBridge.invoke(
      "db:getSetting",
      PREFS.LANGUAGE,
    );
    if (language && language.intVal !== -1) {
      i18n.global.locale.value = getLocaleFromLanguage(language.intVal);
    }
  } catch (error) {
    console.error("Error refreshing language setting:", error);
  }

  try {
    const customCurrencySetting = await platformBridge.invoke(
      "db:getSetting",
      PREFS.CUSTOM_CURRENCY,
    );
    if (customCurrencySetting?.strVal) {
      const parsed = JSON.parse(customCurrencySetting.strVal);
      setCustomCurrency(
        typeof parsed?.symbol === "string" ? parsed.symbol : "",
        typeof parsed?.rate === "number" ? parsed.rate : 1,
        typeof parsed?.name === "string" ? parsed.name : "",
      );
    }
  } catch (error) {
    console.error("Error refreshing custom currency setting:", error);
  }
};

import { createI18n } from "vue-i18n";
import { platformBridge } from "../platformBridge";

// Load translations via platform bridge
const messages = await platformBridge.invoke("i18n:loadTranslations");

const i18n = createI18n({
  legacy: false,
  locale: "en", // default locale
  fallbackLocale: "en",
  messages,
});

export default i18n;

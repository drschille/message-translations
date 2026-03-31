import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import nb from './nb.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      nb: { translation: nb },
      en: { translation: en },
    },
    fallbackLng: 'nb',
    supportedLngs: ['nb', 'en'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        const normalized = (lng || '').toLowerCase();
        if (normalized === 'no' || normalized.startsWith('nb')) return 'nb';
        if (normalized.startsWith('en')) return 'en';
        return 'nb';
      },
    },
  });

export default i18n;

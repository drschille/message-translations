import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggle = () => {
    i18n.changeLanguage(i18n.language === 'nb' ? 'en' : 'nb');
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wide text-[#E5E2E1]/70 hover:text-[#E5E2E1] hover:bg-[#2A2A2A]/50 transition-all duration-300"
      aria-label="Switch language"
    >
      {i18n.language === 'nb' ? 'EN' : 'NO'}
    </button>
  );
}

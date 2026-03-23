import { Share2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FooterProps {
  currentPage?: string;
}

export default function Footer(_props: FooterProps) {
  const { t } = useTranslation();
  return (
    <footer className="w-full py-12 px-8 mt-20 bg-surface-container-lowest border-t border-outline-variant/10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-8">
        <div className="text-sm font-body tracking-wide text-on-surface/50 mb-8 md:mb-0">
          {t('footer.copyright')}
        </div>
        <div className="flex space-x-8">
          <a className="text-on-surface/40 hover:text-on-surface font-body text-sm tracking-wide transition-colors duration-300" href="#">{t('footer.privacyPolicy')}</a>
          <a className="text-on-surface/40 hover:text-on-surface font-body text-sm tracking-wide transition-colors duration-300" href="#">{t('footer.termsOfService')}</a>
          <a className="text-on-surface/40 hover:text-on-surface font-body text-sm tracking-wide transition-colors duration-300" href="#">{t('footer.archiveGuidelines')}</a>
        </div>
        <div className="mt-8 md:mt-0 flex gap-4">
          <button className="text-primary-container hover:text-primary transition-colors">
            <Share2 size={20} />
          </button>
          <button className="text-primary-container hover:text-primary transition-colors">
            <Mail size={20} />
          </button>
        </div>
      </div>
    </footer>
  );
}

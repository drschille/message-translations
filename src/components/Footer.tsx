import { Mail, Youtube } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full mt-20 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto flex flex-col gap-8 px-6 py-12 md:px-20">
        <div className="w-full flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-[20px] leading-none font-headline font-semibold text-on-surface">
              {t("footer.brand.title")}
            </div>
            <p className="text-[13px] font-body text-outline">
              {t("footer.brand.tagline")}
            </p>
          </div>

          <div className="flex flex-wrap gap-12 md:gap-12">
            <div className="flex flex-col gap-3">
              <h3 className="text-xs tracking-[0.08em] uppercase font-body font-semibold text-on-surface">
                {t("footer.navigation.title")}
              </h3>
              <Link to="/" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.navigation.home")}
              </Link>
              <Link to="/sermons" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.navigation.sermons")}
              </Link>
              <Link to="/about" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.navigation.about")}
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs tracking-[0.08em] uppercase font-body font-semibold text-on-surface">
                {t("footer.resources.title")}
              </h3>
              <a href="#" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.resources.audio")}
              </a>
              <Link to="/sermons" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.resources.translations")}
              </Link>
              <a href="#" className="text-[13px] font-body text-outline hover:text-on-surface transition-colors duration-200">
                {t("footer.resources.contact")}
              </a>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-surface-container-high" />

        <div className="w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs font-body text-[#6a6a6a]">{t("footer.copyright")}</p>
          <div className="flex items-center gap-4 text-[#6a6a6a]">
            <a href="#" aria-label={t("footer.social.youtube")} className="hover:text-outline transition-colors duration-200">
              <Youtube size={18} />
            </a>
            <a href="#" aria-label={t("footer.social.email")} className="hover:text-outline transition-colors duration-200">
              <Mail size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

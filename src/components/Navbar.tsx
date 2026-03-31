import { Search, Menu } from "lucide-react";
import { NavLink, Link } from "react-router";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useTranslation();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "font-headline tracking-tight transition-colors duration-300",
      isActive
        ? "text-primary font-bold border-b-2 border-primary pb-1"
        : "text-on-surface/70 hover:text-on-surface"
    );

  return (
    <nav className="fixed top-0 w-full z-50 glass-nav">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <Link
          to="/"
          className="text-2xl font-headline tracking-tighter text-on-surface"
        >
          branham.no
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <NavLink to="/" end className={navLinkClass}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/sermons" className={navLinkClass}>
            {t('nav.sermons')}
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            {t('nav.about')}
          </NavLink>
          <NavLink to="/editor/sermons" className={navLinkClass}>
            {t("nav.proofreading", "Korrektur")}
          </NavLink>
          <span className="font-headline tracking-tight text-on-surface/70 hover:text-on-surface transition-colors duration-300 cursor-pointer">
            {t('nav.contact')}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-surface-container-high/50 transition-all duration-300 rounded-full scale-95 active:scale-90 text-primary">
            <Search size={20} strokeWidth={1.5} />
          </button>
          <LanguageSwitcher />
          {/* Mobile Menu Icon */}
          <button className="md:hidden p-2 text-on-surface">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}

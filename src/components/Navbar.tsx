import { Search, Menu } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

interface NavbarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function Navbar({ currentPage, onPageChange }: NavbarProps) {
  const { t } = useTranslation();
  return (
    <nav className="fixed top-0 w-full z-50 glass-nav">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <span
          className="text-2xl font-headline tracking-tighter text-on-surface cursor-pointer"
          onClick={() => onPageChange('home')}
        >
          branham.no
        </span>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <button
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'home' ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface/70 hover:text-on-surface"
            )}
            onClick={() => onPageChange('home')}
          >
            {t('nav.home')}
          </button>
          <button
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'archive' ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface/70 hover:text-on-surface"
            )}
            onClick={() => onPageChange('archive')}
          >
            {t('nav.sermons')}
          </button>
          <button
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'about' ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface/70 hover:text-on-surface"
            )}
            onClick={() => onPageChange('about')}
          >
            {t('nav.about')}
          </button>
          <button className="font-headline tracking-tight text-on-surface/70 hover:text-on-surface transition-colors duration-300">
            {t('nav.contact')}
          </button>
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

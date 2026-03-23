import { Home, BookOpen, Info, Mail } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function BottomNav({ currentPage, onPageChange }: BottomNavProps) {
  const { t } = useTranslation();
  return (
    <div className="md:hidden fixed bottom-0 w-full bg-background/90 backdrop-blur-lg border-t border-on-surface/10 z-50">
      <div className="flex justify-around items-center py-4">
        <button
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'home' ? "text-primary" : "text-on-surface/70"
          )}
          onClick={() => onPageChange('home')}
        >
          <Home size={20} fill={currentPage === 'home' ? "currentColor" : "none"} />
          <span className="text-[10px]">{t('nav.home')}</span>
        </button>
        <button
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'archive' ? "text-primary" : "text-on-surface/70"
          )}
          onClick={() => onPageChange('archive')}
        >
          <BookOpen size={20} fill={currentPage === 'archive' ? "currentColor" : "none"} />
          <span className="text-[10px]">{t('nav.sermons')}</span>
        </button>
        <button
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'about' ? "text-primary" : "text-on-surface/70"
          )}
          onClick={() => onPageChange('about')}
        >
          <Info size={20} fill={currentPage === 'about' ? "currentColor" : "none"} />
          <span className="text-[10px]">{t('nav.about')}</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-on-surface/70">
          <Mail size={20} />
          <span className="text-[10px]">{t('nav.contact')}</span>
        </button>
      </div>
    </div>
  );
}

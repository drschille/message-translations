import { Home, BookOpen, Info, Mail } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";

export default function BottomNav() {
  const { t } = useTranslation();
  return (
    <div className="md:hidden fixed bottom-0 w-full bg-background/90 backdrop-blur-lg border-t border-on-surface/10 z-50">
      <div className="flex justify-around items-center py-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-on-surface/70"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Home size={20} fill={isActive ? "currentColor" : "none"} />
              <span className="text-[10px]">{t('nav.home')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/sermons"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-on-surface/70"
            )
          }
        >
          {({ isActive }) => (
            <>
              <BookOpen size={20} fill={isActive ? "currentColor" : "none"} />
              <span className="text-[10px]">{t('nav.sermons')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-on-surface/70"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Info size={20} fill={isActive ? "currentColor" : "none"} />
              <span className="text-[10px]">{t('nav.about')}</span>
            </>
          )}
        </NavLink>
        <span className="flex flex-col items-center gap-1 text-on-surface/70 cursor-pointer">
          <Mail size={20} />
          <span className="text-[10px]">{t('nav.contact')}</span>
        </span>
      </div>
    </div>
  );
}

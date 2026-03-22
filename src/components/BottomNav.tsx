import { Home, BookOpen, Info, Mail } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function BottomNav({ currentPage, onPageChange }: BottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 w-full bg-[#131313]/90 backdrop-blur-lg border-t border-[#E5E2E1]/10 z-50">
      <div className="flex justify-around items-center py-4">
        <button 
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'home' ? "text-[#A8C9F4]" : "text-[#E5E2E1]/70"
          )}
          onClick={() => onPageChange('home')}
        >
          <Home size={20} fill={currentPage === 'home' ? "currentColor" : "none"} />
          <span className="text-[10px]">Hjem</span>
        </button>
        <button 
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'archive' ? "text-[#A8C9F4]" : "text-[#E5E2E1]/70"
          )}
          onClick={() => onPageChange('archive')}
        >
          <BookOpen size={20} fill={currentPage === 'archive' ? "currentColor" : "none"} />
          <span className="text-[10px]">Taler</span>
        </button>
        <button 
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            currentPage === 'about' ? "text-[#A8C9F4]" : "text-[#E5E2E1]/70"
          )}
          onClick={() => onPageChange('about')}
        >
          <Info size={20} fill={currentPage === 'about' ? "currentColor" : "none"} />
          <span className="text-[10px]">Om oss</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#E5E2E1]/70">
          <Mail size={20} />
          <span className="text-[10px]">Kontakt</span>
        </button>
      </div>
    </div>
  );
}

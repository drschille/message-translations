import { Search, Globe, Menu } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface NavbarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function Navbar({ currentPage, onPageChange }: NavbarProps) {
  return (
    <nav className="fixed top-0 w-full z-50 glass-nav">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <span 
          className="text-2xl font-headline tracking-tighter text-[#E5E2E1] cursor-pointer"
          onClick={() => onPageChange('home')}
        >
          branham.no
        </span>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <button 
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'home' ? "text-[#A8C9F4] font-bold border-b-2 border-[#A8C9F4] pb-1" : "text-[#E5E2E1]/70 hover:text-[#E5E2E1]"
            )}
            onClick={() => onPageChange('home')}
          >
            Hjem
          </button>
          <button 
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'archive' ? "text-[#A8C9F4] font-bold border-b-2 border-[#A8C9F4] pb-1" : "text-[#E5E2E1]/70 hover:text-[#E5E2E1]"
            )}
            onClick={() => onPageChange('archive')}
          >
            Taler
          </button>
          <button 
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'translations' ? "text-[#A8C9F4] font-bold border-b-2 border-[#A8C9F4] pb-1" : "text-[#E5E2E1]/70 hover:text-[#E5E2E1]"
            )}
            onClick={() => onPageChange('translations')}
          >
            Oversettelser
          </button>
          <button 
            className={cn(
              "font-headline tracking-tight transition-colors duration-300",
              currentPage === 'about' ? "text-[#A8C9F4] font-bold border-b-2 border-[#A8C9F4] pb-1" : "text-[#E5E2E1]/70 hover:text-[#E5E2E1]"
            )}
            onClick={() => onPageChange('about')}
          >
            Om oss
          </button>
          <button className="font-headline tracking-tight text-[#E5E2E1]/70 hover:text-[#E5E2E1] transition-colors duration-300">
            Kontakt
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-[#2A2A2A]/50 transition-all duration-300 rounded-full scale-95 active:scale-90 text-[#A8C9F4]">
            <Search size={20} strokeWidth={1.5} />
          </button>
          <button className="p-2 hover:bg-[#2A2A2A]/50 transition-all duration-300 rounded-full scale-95 active:scale-90 text-[#A8C9F4]">
            <Globe size={20} strokeWidth={1.5} />
          </button>
          {/* Mobile Menu Icon */}
          <button className="md:hidden p-2 text-[#E5E2E1]">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}

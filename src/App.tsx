import { useState, useEffect } from "react";
import { ConvexProvider, ConvexReactClient, usePaginatedQuery, useMutation } from "convex/react";
import { Search, Filter, SortAsc, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SermonItem from "./components/SermonItem";
import AboutPage from "./components/AboutPage";
import TranslationsPage from "./components/TranslationsPage";
import BottomNav from "./components/BottomNav";
import HomeContent from "./components/HomeContent";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "motion/react";

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const isValidConvexUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.hostname.endsWith(".convex.cloud") || parsed.hostname.endsWith(".convex.site")) && 
           !parsed.hostname.includes("mock-url") && 
           !parsed.hostname.includes("your-deployment");
  } catch {
    return false;
  }
};

const convex = (function() {
  if (isValidConvexUrl(convexUrl)) {
    try {
      return new ConvexReactClient(convexUrl as string);
    } catch (e) {
      console.error("Failed to initialize Convex client:", e);
      return null;
    }
  }
  return null;
})();

function ArchiveContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  
  // These hooks will now only be called if ArchiveContent is rendered inside a ConvexProvider
  const paginatedResults = usePaginatedQuery(
    api.sermons.list as any,
    { 
      search: searchQuery || undefined,
      year: selectedYear || undefined,
      series: selectedSeries || undefined
    },
    { initialNumItems: 10 }
  );

  const results = paginatedResults?.results || [];
  const status = paginatedResults?.status || "LoadingFirstPage";
  const loadMore = paginatedResults?.loadMore || (() => {});

  const seed = useMutation(api.sermons.seed as any);

  useEffect(() => {
    if (seed) {
      seed();
    }
  }, [seed]);

  const years = ["1963", "1964", "1965"];
  const series = ["The Seven Seals", "Church Ages"];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-5xl mx-auto"
    >
      <header className="mb-16">
        <h1 className="text-5xl md:text-6xl font-headline font-bold text-on-surface mb-8 tracking-tighter">Sermons Archive</h1>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 group-focus-within:text-primary transition-colors" size={20} />
            <input 
              className="w-full bg-surface-container-low border-none focus:ring-1 focus:ring-secondary py-4 pl-12 pr-4 rounded text-on-surface placeholder:text-on-surface/30 font-body transition-all" 
              placeholder="Search by title, date, or scripture..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              className="bg-surface-container-high hover:bg-surface-container-highest px-6 py-4 rounded transition-colors text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value || null)}
            >
              <option value="">Year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select 
              className="bg-surface-container-high hover:bg-surface-container-highest px-6 py-4 rounded transition-colors text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none"
              value={selectedSeries || ""}
              onChange={(e) => setSelectedSeries(e.target.value || null)}
            >
              <option value="">Series</option>
              {series.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(searchQuery || selectedYear || selectedSeries) && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedYear(null);
                  setSelectedSeries(null);
                }}
                className="bg-primary text-on-primary px-6 py-4 rounded font-bold text-sm uppercase tracking-widest"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="space-y-4">
        {results.map((sermon) => (
          <SermonItem key={sermon._id} sermon={sermon as any} />
        ))}

        {status === "LoadingMore" && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        <div className="py-12 flex justify-end">
          <div className="w-full md:w-3/4 relative aspect-video overflow-hidden rounded-lg group">
            <img 
              alt="Historical archival texture" 
              className="object-cover w-full h-full grayscale opacity-40 group-hover:scale-105 transition-transform duration-700" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3i9IumzXLjtwX8Je5v3SiQVwNLWKhMRofXdrN0R-5ah0peSwKu_g2eGo0QjiinbwvAqHl_Bae1fCxSkj-Pf7NC8VTm805rt4_xl6HHUJdBXa6UiyYa-ZnOWrVhpKDX9rp4ks3OQclNp18cEBiFnZK22P0vevW7UrqAut3bRXdcm-yn5a16IvJxIHSDwz3ZffPhsYovoG4DOhExBFAUxjPwj60pnT3oxk7DGeKj2DRTRVd57PuHhB095jS2mUQdewW9FeaCVbWbRF8"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
            <div className="absolute bottom-8 left-8">
              <p className="font-headline italic text-2xl text-secondary max-w-md">
                "He that hath an ear, let him hear what the Spirit saith unto the churches."
              </p>
            </div>
          </div>
        </div>
      </section>

      {status !== "LoadingFirstPage" && results.length > 0 && (
        <div className="mt-20 flex justify-center">
          <button 
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(10)}
            className="px-8 py-4 bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-all text-sm font-bold disabled:opacity-50 uppercase tracking-widest"
          >
            {status === "LoadingMore" ? "Loading..." : "Load More Sermons"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function ArchivePage() {
  if (!convex) {
    return (
      <div className="pt-32 pb-24 px-6 text-center">
        <h2 className="text-2xl font-headline text-on-surface mb-4">Database Not Configured</h2>
        <p className="text-on-surface-variant">Please set VITE_CONVEX_URL in your environment variables to enable the archive.</p>
      </div>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <ArchiveContent />
    </ConvexProvider>
  );
}

function TranslationsWrapper() {
  if (!convex) {
    return (
      <div className="pt-32 pb-24 px-6 text-center">
        <h2 className="text-2xl font-headline text-on-surface mb-4">Database Not Configured</h2>
        <p className="text-on-surface-variant">Please set VITE_CONVEX_URL in your environment variables to enable translations.</p>
      </div>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <TranslationsPage />
    </ConvexProvider>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentPage={currentPage} onPageChange={setCurrentPage} />
      <AnimatePresence mode="wait">
        {currentPage === 'home' && (
          <HomeContent key="home" />
        )}
        {currentPage === 'archive' && (
          <ArchivePage key="archive" />
        )}
        {currentPage === 'translations' && (
          <motion.div
            key="translations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TranslationsWrapper />
          </motion.div>
        )}
        {currentPage === 'about' && (
          <motion.div
            key="about"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <AboutPage />
          </motion.div>
        )}
      </AnimatePresence>
      <Footer currentPage={currentPage} />
      <BottomNav currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  );
}

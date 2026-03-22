import { useState, useEffect, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, usePaginatedQuery, useMutation } from "convex/react";
import { Search, Filter, SortAsc, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SermonItem from "./components/SermonItem";
import AboutPage from "./components/AboutPage";
import TranslationsPage from "./components/TranslationsPage";
import BottomNav from "./components/BottomNav";
import HomeContent from "./components/HomeContent";
import ReaderPage from "./components/ReaderPage";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "motion/react";
import { useDebounce } from "@/src/hooks/useDebounce";

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

function ConvexErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function ArchiveContent({ onOpenReader }: { onOpenReader: (sermon: any) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // These hooks will now only be called if ArchiveContent is rendered inside a ConvexProvider
  const paginatedResults = usePaginatedQuery(
    api.sermons.list as any,
    { 
      search: debouncedSearchQuery || undefined,
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
      seed().catch((err: any) => {
        console.error("Seed failed:", err);
        if (err.message?.includes("Could not find public function")) {
          setError("Deployment Required: Please run 'npx convex deploy' in your terminal to activate the backend functions.");
        }
      });
    }
  }, [seed]);

  // Catch errors from usePaginatedQuery if possible (though it usually just returns undefined on error)
  useEffect(() => {
    if (status === "LoadingFirstPage" && !paginatedResults && !error) {
      // This is a heuristic for a potential server error if it stays loading forever
      const timer = setTimeout(() => {
        if (status === "LoadingFirstPage" && !paginatedResults) {
          setError("Still loading... If this persists, ensure you have run 'npx convex deploy' to push your functions to the cloud.");
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, paginatedResults, error]);

  if (error) {
    return (
      <div className="pt-32 pb-24 px-6 text-center max-w-2xl mx-auto">
        <div className="bg-error-container text-on-error-container p-8 rounded-2xl border border-error/20">
          <h2 className="text-2xl font-headline mb-4 font-bold">Backend Deployment Required</h2>
          <p className="mb-6 opacity-90">{error}</p>
          <div className="bg-surface-container-lowest p-4 rounded font-mono text-sm text-left mb-6 overflow-x-auto">
            <code>npx convex deploy</code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform"
          >
            Retry After Deploying
          </button>
        </div>
      </div>
    );
  }

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
      </header>

      <section className="mb-12 sticky top-[64px] z-40">
        <div className="bg-surface-container-low p-2 rounded-xl flex flex-col md:flex-row gap-2 md:gap-4 items-center shadow-2xl border border-outline-variant/10 w-full max-w-full overflow-hidden">
          <div className="relative w-full flex-grow group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 group-focus-within:text-primary transition-colors" size={20} />
            <input 
              className="w-full bg-surface-container-low border-none focus:ring-1 focus:ring-secondary py-4 pl-12 pr-4 rounded text-on-surface placeholder:text-on-surface/30 font-body transition-all text-sm md:text-base" 
              placeholder="Search by title, date, or scripture..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar shrink-0">
            <select 
              className="flex-1 md:flex-none bg-surface-container-high hover:bg-surface-container-highest px-4 md:px-6 py-4 rounded transition-colors text-xs md:text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none min-w-[100px]"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value || null)}
            >
              <option value="">Year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select 
              className="flex-1 md:flex-none bg-surface-container-high hover:bg-surface-container-highest px-4 md:px-6 py-4 rounded transition-colors text-xs md:text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none min-w-[120px]"
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
                className="px-4 md:px-6 py-4 bg-primary text-on-primary rounded transition-colors text-xs md:text-sm font-bold shadow-lg shadow-primary/10 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {results.map((sermon) => (
          <div key={sermon._id}>
            <SermonItem sermon={sermon as any} onReadText={onOpenReader} />
          </div>
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

function ArchivePage({ onOpenReader }: { onOpenReader: (sermon: any) => void }) {
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
      <ConvexErrorBoundary>
        <ArchiveContent onOpenReader={onOpenReader} />
      </ConvexErrorBoundary>
    </ConvexProvider>
  );
}

function TranslationsWrapper({ onOpenReader }: { onOpenReader: (sermon: any) => void }) {
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
      <ConvexErrorBoundary>
        <TranslationsPage onOpenReader={onOpenReader} />
      </ConvexErrorBoundary>
    </ConvexProvider>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedSermon, setSelectedSermon] = useState<any>(null);

  const openReader = (sermon: any) => {
    setSelectedSermon(sermon);
    setCurrentPage('reader');
  };

  const closeReader = () => {
    setCurrentPage('archive');
  };

  const shouldRenderShell = currentPage !== 'reader';

  return (
    <div className="min-h-screen flex flex-col">
      {shouldRenderShell && <Navbar currentPage={currentPage} onPageChange={setCurrentPage} />}
      <AnimatePresence mode="wait">
        {currentPage === 'home' && (
          <HomeContent key="home" />
        )}
        {currentPage === 'archive' && (
          <motion.div
            key="archive"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TranslationsWrapper onOpenReader={openReader} />
          </motion.div>
        )}
        {currentPage === 'translations' && (
          <motion.div
            key="translations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TranslationsWrapper onOpenReader={openReader} />
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
        {currentPage === 'reader' && (
          <motion.div
            key="reader"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {convex ? (
              <ConvexProvider client={convex}>
                <ConvexErrorBoundary>
                  <ReaderPage sermon={selectedSermon} onBack={closeReader} />
                </ConvexErrorBoundary>
              </ConvexProvider>
            ) : (
              <ReaderPage sermon={selectedSermon} onBack={closeReader} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {shouldRenderShell && <Footer currentPage={currentPage} />}
      {shouldRenderShell && <BottomNav currentPage={currentPage} onPageChange={setCurrentPage} />}
    </div>
  );
}

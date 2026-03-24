import { useState, useEffect } from "react";
import { Search, Calendar, Filter, Headphones, FileText, Play, ExternalLink, Quote as QuoteIcon, BookOpen } from "lucide-react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/src/lib/utils";
import { useDebounce } from "@/src/hooks/useDebounce";

interface TranslationsPageProps {
  onOpenReader?: (sermon: any) => void;
}

export default function TranslationsPage({ onOpenReader }: TranslationsPageProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const seed = useMutation(api.sermons.seed as any);

  useEffect(() => {
    if (seed) {
      seed().catch((err: any) => {
        console.error("Seed failed:", err);
        if (err.message?.includes("Could not find public function")) {
          setError(t('errors.deploymentMessage'));
        }
      });
    }
  }, [seed, t]);

  useEffect(() => {
    if (status === "LoadingFirstPage" && !paginatedResults && !error) {
      const timer = setTimeout(() => {
        if (status === "LoadingFirstPage" && !paginatedResults) {
          setError(t('errors.timeoutMessage'));
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, paginatedResults, error, t]);

  if (error) {
    return (
      <div className="pt-32 pb-24 px-6 text-center max-w-2xl mx-auto">
        <div className="bg-error-container text-on-error-container p-8 rounded-2xl border border-error/20">
          <h2 className="text-2xl font-headline mb-4 font-bold">{t('errors.deploymentRequired')}</h2>
          <p className="mb-6 opacity-90">{error}</p>
          <div className="bg-surface-container-lowest p-4 rounded font-mono text-sm text-left mb-6 overflow-x-auto">
            <code>npx convex deploy</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform"
          >
            {t('errors.retryAfterDeploying')}
          </button>
        </div>
      </div>
    );
  }

  const featuredSermon = results[0];
  const otherSermons = results.slice(1);

  const years = ["1963", "1964", "1965"];
  const series = [t('archive.sevenSeals'), t('archive.churchAges')];

  return (
    <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <header className="mb-16 space-y-6">
        <div className="inline-block px-3 py-1 bg-surface-container-high rounded-full">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary">{t('translations.digitalArchive')}</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-headline tracking-tight leading-tight max-w-3xl">
          {t('translations.title')} <span className="italic text-primary">{t('translations.titleHighlight')}</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl font-light leading-relaxed">
          {t('translations.subtitle')}
        </p>
      </header>

      <section className="mb-12 sticky top-16 z-40">
        <div className="bg-surface-container-low p-2 rounded-xl flex flex-col md:flex-row gap-2 md:gap-4 items-center shadow-2xl border border-outline-variant/10 w-full max-w-full overflow-hidden">
          <div className="relative w-full grow group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 group-focus-within:text-primary transition-colors" size={20} />
            <input
              className="w-full bg-surface-container-low border-none focus:ring-1 focus:ring-secondary py-4 pl-12 pr-4 rounded text-on-surface placeholder:text-on-surface/30 font-body transition-all text-sm md:text-base"
              placeholder={t('translations.searchPlaceholder')}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar shrink-0">
            <select
              className="flex-1 md:flex-none bg-surface-container-high hover:bg-surface-container-highest px-4 md:px-6 py-4 rounded transition-colors text-xs md:text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none min-w-25"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value || null)}
            >
              <option value="">{t('common.year')}</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              className="flex-1 md:flex-none bg-surface-container-high hover:bg-surface-container-highest px-4 md:px-6 py-4 rounded transition-colors text-xs md:text-sm font-label tracking-widest uppercase border-none focus:ring-0 appearance-none min-w-30"
              value={selectedSeries || ""}
              onChange={(e) => setSelectedSeries(e.target.value || null)}
            >
              <option value="">{t('common.series')}</option>
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
                {t('common.reset')}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {status === "LoadingFirstPage" ? (
          <div className="text-center py-20 text-outline">{t('translations.loadingSermons')}</div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 text-outline">{t('translations.noResults')}</div>
        ) : (
          <>
            {featuredSermon && (
              <div className="group relative bg-surface-container border border-outline-variant/10 rounded-xl overflow-hidden hover:bg-surface-container-high transition-all duration-500 p-8 flex flex-col md:flex-row gap-8 items-center">
                <div className="shrink-0 w-full md:w-64 aspect-square bg-surface-container-highest rounded-lg overflow-hidden relative">
                  <img
                    className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                    src="https://picsum.photos/seed/sermon/800/800"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="text-primary opacity-80 group-hover:scale-110 transition-transform" size={64} fill="currentColor" />
                  </div>
                </div>
                <div className="grow space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs tracking-widest font-bold text-secondary uppercase">Jeffersonville, IN</span>
                    <span className="text-xs text-outline">•</span>
                    <span className="text-xs text-outline">{formatDate(featuredSermon.date, i18n.language)}</span>
                  </div>
                  <h3 className="text-3xl font-headline text-on-surface group-hover:text-primary transition-colors">
                    {featuredSermon.title}
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed max-w-xl">
                    {featuredSermon.description}
                  </p>
                  <div className="flex flex-wrap gap-4 pt-4">
                    <button className="flex items-center gap-2 px-6 py-3 bg-linear-to-tr from-primary to-primary-container text-on-primary rounded-md font-bold text-sm hover:opacity-90 transition-opacity">
                      <Headphones size={18} /> {t('translations.listenNow')}
                    </button>
                    <button
                      onClick={() => onOpenReader?.(featuredSermon)}
                      className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest text-on-surface rounded-md font-bold text-sm hover:bg-surface-bright transition-colors"
                    >
                      <FileText size={18} /> {t('translations.readText')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {otherSermons.map((sermon) => (
                <div key={sermon._id} className="group bg-surface-container-low p-6 rounded-xl hover:bg-surface-container transition-all duration-300 flex flex-col justify-between min-h-55">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] tracking-widest text-outline uppercase">62-1231</span>
                      <div className="flex gap-2">
                        <Headphones className="text-primary-container" size={18} />
                        <FileText className="text-secondary" size={18} />
                      </div>
                    </div>
                    <h4 className="text-xl font-headline group-hover:text-secondary transition-colors">{sermon.title}</h4>
                    <p className="text-sm text-on-surface-variant line-clamp-2">{sermon.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-6">
                    <span className="text-xs text-outline-variant">{formatDate(sermon.date, i18n.language)}</span>
                    <div className="flex gap-2">
                      <button className="p-2 bg-surface-container-highest hover:bg-primary hover:text-on-primary rounded-md transition-all">
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button
                        onClick={() => onOpenReader?.(sermon)}
                        className="p-2 bg-surface-container-highest hover:bg-secondary hover:text-on-secondary rounded-md transition-all"
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {status !== "LoadingFirstPage" && results.length > 0 && (
        <div className="mt-20 flex justify-center items-center gap-4">
          <button
            disabled={status === "LoadingMore"}
            onClick={() => paginatedResults.loadMore(10)}
            className="px-8 py-4 bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-all text-sm font-bold disabled:opacity-50"
          >
            {status === "LoadingMore" ? t('translations.loadingMore') : t('translations.loadMore')}
          </button>
        </div>
      )}

      <section className="w-full bg-surface-container-low py-24 px-8 relative overflow-hidden mt-20 -mx-6 md:-mx-12 lg:-mx-24">
        <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
          <BookOpen size={640} />
        </div>
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <QuoteIcon className="text-secondary mx-auto" size={48} />
          <blockquote className="text-3xl md:text-5xl font-headline italic text-on-surface leading-snug">
            "Ikke se på mannen, se på Budskapet. Det er ikke mannen som teller, det er Guds Ord som blir åpenbart gjennom ham."
          </blockquote>
          <cite className="block text-secondary font-label tracking-[0.2em] uppercase text-sm font-bold">— William Marrion Branham</cite>
        </div>
      </section>
    </main>
  );
}

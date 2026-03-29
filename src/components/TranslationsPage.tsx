import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Headphones,
  Quote as QuoteIcon,
  Search,
} from "lucide-react";
import { Link } from "react-router";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/src/lib/utils";
import { useDebounce } from "@/src/hooks/useDebounce";
import quoteImage from "@/src/assets/light_over_shoulder.jpg";

export default function TranslationsPage() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [expandedSermonId, setExpandedSermonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paginatedResults = usePaginatedQuery(
    api.sermons.list as any,
    {
      search: debouncedSearchQuery || undefined,
      year: selectedYear || undefined,
      series: selectedSeries || undefined,
    },
    { initialNumItems: 10 },
  );

  const results = paginatedResults?.results || [];
  const status = paginatedResults?.status || "LoadingFirstPage";

  const seed = useMutation(api.sermons.seed as any);

  useEffect(() => {
    if (seed) {
      seed().catch((err: any) => {
        console.error("Seed failed:", err);
        if (err.message?.includes("Could not find public function")) {
          setError(t("errors.deploymentMessage"));
        }
      });
    }
  }, [seed, t]);

  useEffect(() => {
    if (status === "LoadingFirstPage" && !paginatedResults && !error) {
      const timer = setTimeout(() => {
        if (status === "LoadingFirstPage" && !paginatedResults) {
          setError(t("errors.timeoutMessage"));
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, paginatedResults, error, t]);

  useEffect(() => {
    if (results.length === 0) {
      setExpandedSermonId(null);
      return;
    }

    setExpandedSermonId((current) => {
      if (current && results.some((sermon) => sermon._id === current)) {
        return current;
      }
      return results[0]?._id ?? null;
    });
  }, [results]);

  if (error) {
    return (
      <div className="pt-32 pb-24 px-6 text-center max-w-2xl mx-auto">
        <div className="bg-error-container text-on-error-container p-8 rounded-2xl border border-error/20">
          <h2 className="text-2xl font-headline mb-4 font-bold">{t("errors.deploymentRequired")}</h2>
          <p className="mb-6 opacity-90">{error}</p>
          <div className="bg-surface-container-lowest p-4 rounded font-mono text-sm text-left mb-6 overflow-x-auto">
            <code>npx convex deploy</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-105 transition-transform"
          >
            {t("errors.retryAfterDeploying")}
          </button>
        </div>
      </div>
    );
  }

  const years = ["1963", "1964", "1965"];
  const series = [t("archive.sevenSeals"), t("archive.churchAges")];

  return (
    <main className="pt-30 pb-20 px-6 max-w-7xl mx-auto">
      <header className="mb-10 space-y-5">
        <h1 className="text-5xl md:text-7xl font-headline tracking-tight leading-tight max-w-3xl">
          {t("translations.title")} <span className="italic text-primary">{t("translations.titleHighlight")}</span>
        </h1>
      </header>

      <section className="mb-8 sticky top-16 z-40">
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              className="w-full bg-transparent border border-outline-variant/40 rounded-md py-2.5 pl-9 pr-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
              placeholder={t("translations.searchPlaceholder")}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="hidden md:inline-flex items-center rounded-md bg-surface-container-high px-3 py-2 text-[11px] tracking-[0.18em] uppercase text-on-surface font-medium">
              {t("translations.filters")}
            </span>
            <span className="hidden md:inline-flex items-center rounded-md bg-surface-container-high px-3 py-2 text-[11px] tracking-[0.18em] uppercase text-on-surface font-medium">
              {t("translations.latest")}
            </span>
            <select
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-22"
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value || null)}
            >
              <option value="">{t("common.year")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-28"
              value={selectedSeries || ""}
              onChange={(e) => setSelectedSeries(e.target.value || null)}
            >
              <option value="">{t("common.series")}</option>
              {series.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {(searchQuery || selectedYear || selectedSeries) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedYear(null);
                  setSelectedSeries(null);
                }}
                className="px-3 py-2 bg-primary text-on-primary rounded-md text-xs font-semibold whitespace-nowrap"
              >
                {t("common.reset")}
              </button>
            )}
          </div>
        </div>
      </section>

      {status === "LoadingFirstPage" ? (
        <div className="text-center py-20 text-outline">{t("translations.loadingSermons")}</div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-outline">{t("translations.noResults")}</div>
      ) : (
        <section className="border border-outline-variant/25 rounded-lg overflow-hidden bg-surface-container-low">
          {results.map((sermon, index) => {
            const isExpanded = expandedSermonId === sermon._id;
            const hasAudio = Boolean((sermon as any).audioUrl);
            const hasPdf = Boolean((sermon as any).pdfUrl);

            return (
              <article
                key={sermon._id}
                className={`border-b border-outline-variant/20 last:border-b-0 ${isExpanded ? "bg-surface-container" : "bg-transparent"}`}
              >
                <button
                  type="button"
                  className="w-full text-left px-4 md:px-6 py-4 flex items-center gap-3"
                  onClick={() => {
                    setExpandedSermonId((current) => (current === sermon._id ? null : sermon._id));
                  }}
                >
                  <span className="text-[11px] tracking-[0.16em] uppercase text-secondary/80 shrink-0">
                    {formatDate(sermon.date, i18n.language)}
                  </span>
                  <h2 className={`font-headline text-lg md:text-xl ${index === 0 ? "text-primary" : "text-on-surface"}`}>
                    {sermon.title}
                  </h2>
                  <ChevronDown
                    size={16}
                    className={`ml-auto text-outline transition-transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`px-4 md:px-6 pb-5 transition-all duration-300 ease-out ${
                        isExpanded ? "translate-y-0" : "-translate-y-1"
                      }`}
                    >
                      <p className="text-on-surface-variant text-sm md:text-base leading-relaxed max-w-4xl">
                        {sermon.description || t("translations.noDescription")}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-outline">
                        <span>
                          {t("translations.scripture")}: {(sermon as any).scripture || "-"}
                        </span>
                        <span>
                          {t("translations.series")}: {(sermon as any).series || "-"}
                        </span>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          to={`/sermons/${sermon._id}`}
                          className="inline-flex items-center gap-2 rounded-md bg-surface-container-high px-3 py-2 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                          <FileText size={14} />
                          {t("translations.readText")}
                        </Link>
                        <a
                          href={hasAudio ? (sermon as any).audioUrl : "#"}
                          target={hasAudio ? "_blank" : undefined}
                          rel={hasAudio ? "noopener noreferrer" : undefined}
                          aria-disabled={!hasAudio}
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                            hasAudio
                              ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                              : "bg-surface-container-high text-outline cursor-not-allowed"
                          }`}
                        >
                          <Headphones size={14} />
                          {t("translations.listen")}
                        </a>
                        <a
                          href={hasPdf ? (sermon as any).pdfUrl : "#"}
                          target={hasPdf ? "_blank" : undefined}
                          rel={hasPdf ? "noopener noreferrer" : undefined}
                          aria-disabled={!hasPdf}
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                            hasPdf
                              ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                              : "bg-surface-container-high text-outline cursor-not-allowed"
                          }`}
                        >
                          <Download size={14} />
                          {t("translations.download")}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="mt-8 rounded-lg overflow-hidden border border-outline-variant/20 bg-surface-container-low">
        <div className="relative min-h-56 md:min-h-64">
          <img src={quoteImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/55 to-black/40" />
          <div className="relative z-10 p-6 md:p-10 max-w-3xl">
            <QuoteIcon className="text-secondary mb-4" size={28} />
            <blockquote className="text-xl md:text-3xl leading-snug italic font-headline text-on-surface">
              {t("translations.quoteText")}
            </blockquote>
            <cite className="mt-4 block text-xs tracking-[0.18em] uppercase text-secondary">
              {t("translations.quoteAuthor")}
            </cite>
          </div>
        </div>
      </section>

      <section className="mt-6 flex items-center justify-center gap-2 pb-6">
        <button
          type="button"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-outline-variant/30 text-outline hover:text-on-surface hover:border-outline transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] tracking-[0.25em] uppercase text-secondary px-2">{t("translations.pageIndicator")}</span>
        <button
          type="button"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-outline-variant/30 text-outline hover:text-on-surface hover:border-outline transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </section>

      {status !== "LoadingFirstPage" && results.length > 0 && (
        <div className="mt-2 flex justify-center items-center gap-4">
          <button
            disabled={status === "LoadingMore"}
            onClick={() => paginatedResults.loadMore(10)}
            className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-md transition-all text-xs font-bold disabled:opacity-50"
          >
            {status === "LoadingMore" ? t("translations.loadingMore") : t("translations.loadMore")}
          </button>
        </div>
      )}
    </main>
  );
}

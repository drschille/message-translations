import { ChevronDown, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/src/lib/utils";

type ProofreadingState = "queued" | "in_progress" | "done";

function normalizeLanguageCode(i18nLanguage: string) {
  const v = (i18nLanguage || "nb").toLowerCase();
  if (v === "no" || v.startsWith("nb")) return "nb";
  return "en";
}

function stateLabel(state: ProofreadingState, t: any) {
  if (state === "in_progress") return t("proofreading.state.inProgress");
  if (state === "done") return t("proofreading.state.done");
  return t("proofreading.state.queued");
}

export default function EditorSermonsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const languageCode = normalizeLanguageCode(i18n.language);

  const search = searchParams.get("q") ?? "";
  const year = searchParams.get("year") ?? "";
  const series = searchParams.get("series") ?? "";
  const proofreadingState = (searchParams.get("proofreadingState") ?? "") as ProofreadingState | "";
  const published = searchParams.get("published") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = 50;

  const sermonsResult = useQuery(api.sermons.list as any, {
    search: search || undefined,
    year: year || undefined,
    series: series || undefined,
    proofreadingState: proofreadingState || undefined,
    isPublished: published ? published === "published" : undefined,
    languageCode,
    paginationOpts: {
      cursor: page === 1 ? null : String((page - 1) * pageSize),
      numItems: pageSize,
    },
  });

  const years = useQuery((api as any).sermons.listYears, {}) ?? [];
  const items = sermonsResult?.page ?? [];
  const totalCount = sermonsResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <main className="pt-30 pb-20 px-6 max-w-7xl mx-auto">
      <header className="mb-10 space-y-5">
        <h1 className="text-5xl md:text-7xl font-headline tracking-tight leading-tight max-w-4xl">
          {t("proofreading.queueTitle")} <span className="italic text-primary">{t("nav.proofreading")}</span>
        </h1>
      </header>

      <section className="mb-8 sticky top-16 z-40">
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder={t("translations.searchPlaceholder")}
              className="w-full bg-transparent border border-outline-variant/40 rounded-md py-2.5 pl-9 pr-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <select
              value={year}
              onChange={(e) => setParam("year", e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-22"
            >
              <option value="">{t("common.year")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={series}
              onChange={(e) => setParam("series", e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-28"
            >
              <option value="">{t("common.series")}</option>
              <option value="The Seven Seals">{t("archive.sevenSeals")}</option>
              <option value="Church Ages">{t("archive.churchAges")}</option>
            </select>
            <select
              value={proofreadingState}
              onChange={(e) => setParam("proofreadingState", e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-28"
            >
              <option value="">{t("proofreading.filter.state")}</option>
              <option value="queued">{t("proofreading.state.queued")}</option>
              <option value="in_progress">{t("proofreading.state.inProgress")}</option>
              <option value="done">{t("proofreading.state.done")}</option>
            </select>
            <select
              value={published}
              onChange={(e) => setParam("published", e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 rounded-md px-3 py-2 text-xs font-label tracking-wide text-on-surface min-w-28"
            >
              <option value="">{t("proofreading.filter.published")}</option>
              <option value="published">{t("proofreading.published")}</option>
              <option value="unpublished">{t("proofreading.unpublished")}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="border border-outline-variant/25 rounded-lg overflow-hidden bg-surface-container-low">
        {items.length === 0 ? (
          <div className="p-8 text-on-surface-variant">{t("translations.noResults")}</div>
        ) : (
          items.map((sermon: any) => {
            const state = (sermon.proofreadingState ?? "queued") as ProofreadingState;
            return (
              <article
                key={sermon._id}
                className="border-b border-outline-variant/20 last:border-b-0 bg-transparent"
              >
                <div className="w-full text-left px-4 md:px-6 py-4 flex items-center gap-3">
                  <span className="text-[11px] tracking-[0.16em] uppercase text-secondary/80 shrink-0">
                    {formatDate(sermon.date, languageCode)}
                  </span>
                  <h2 className="font-headline text-lg md:text-xl text-on-surface">{sermon.title}</h2>
                  <ChevronDown className="ml-auto text-outline" size={16} />
                </div>

                <div className="px-4 md:px-6 pb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-outline/40 px-2 py-0.5 text-on-surface-variant">
                    {stateLabel(state, t)}
                  </span>
                  <span className="rounded-full border border-outline/40 px-2 py-0.5 text-on-surface-variant">
                    {sermon.isPublished
                      ? `v${sermon.currentVersion ?? 0}`
                      : t("proofreading.unpublished")}
                  </span>
                  <Link
                    to={`/editor/sermons/${sermon._id}`}
                    className="ml-auto inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary"
                  >
                    {t("proofreading.openProofreader")}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setParam("page", String(page - 1))}
          className="rounded border border-outline/30 px-3 py-1.5 disabled:opacity-50"
        >
          {t("common.back")}
        </button>
        <span className="text-on-surface-variant">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setParam("page", String(page + 1))}
          className="rounded border border-outline/30 px-3 py-1.5 disabled:opacity-50"
        >
          {t("proofreading.nextPage")}
        </button>
      </div>
    </main>
  );
}

import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/src/lib/utils";

type ProofreadingState = "queued" | "in_progress" | "done";

function stateLabel(state: ProofreadingState, t: any) {
  if (state === "in_progress") return t("proofreading.state.inProgress", "In progress");
  if (state === "done") return t("proofreading.state.done", "Done");
  return t("proofreading.state.queued", "Queued");
}

export default function EditorSermonsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolvedLanguage = (i18n.resolvedLanguage || i18n.language || "nb").toLowerCase();
  const languageCode = resolvedLanguage === "no" || resolvedLanguage.startsWith("nb") ? "nb" : "en";
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
      <header className="mb-8">
        <h1 className="text-4xl md:text-6xl font-headline tracking-tight text-on-surface">
          {t("nav.proofreading", "Korrektur")}
        </h1>
        <p className="mt-2 text-on-surface-variant">
          {t("proofreading.editorQueueSubtitle", "Manage sermon proofreading workflow and publishing.")}
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input
          value={search}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder={t("translations.searchPlaceholder")}
          className="md:col-span-2 w-full rounded-md border border-outline-variant/30 bg-background px-3 py-2 text-sm"
        />
        <select
          value={year}
          onChange={(e) => setParam("year", e.target.value)}
          className="rounded-md border border-outline-variant/30 bg-background px-3 py-2 text-sm"
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
          className="rounded-md border border-outline-variant/30 bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("common.series")}</option>
          <option value="The Seven Seals">{t("archive.sevenSeals")}</option>
          <option value="Church Ages">{t("archive.churchAges")}</option>
        </select>
        <select
          value={proofreadingState}
          onChange={(e) => setParam("proofreadingState", e.target.value)}
          className="rounded-md border border-outline-variant/30 bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("proofreading.filter.state", "Proofreading state")}</option>
          <option value="queued">{t("proofreading.state.queued", "Queued")}</option>
          <option value="in_progress">{t("proofreading.state.inProgress", "In progress")}</option>
          <option value="done">{t("proofreading.state.done", "Done")}</option>
        </select>
        <select
          value={published}
          onChange={(e) => setParam("published", e.target.value)}
          className="rounded-md border border-outline-variant/30 bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("proofreading.filter.published", "Publish status")}</option>
          <option value="published">{t("proofreading.published", "Published")}</option>
          <option value="unpublished">{t("proofreading.unpublished", "Unpublished")}</option>
        </select>
      </section>

      <section className="rounded-lg border border-outline-variant/25 overflow-hidden bg-surface-container-low">
        {items.length === 0 ? (
          <div className="p-8 text-on-surface-variant">{t("translations.noResults")}</div>
        ) : (
          items.map((sermon: any) => {
            const state = (sermon.proofreadingState ?? "queued") as ProofreadingState;
            const publishedText = sermon.isPublished
              ? `v${sermon.currentVersion ?? 0}`
              : t("proofreading.unpublished", "Unpublished");
            return (
              <article
                key={sermon._id}
                className="flex flex-col gap-3 border-b border-outline-variant/20 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.14em] text-outline">
                    {formatDate(sermon.date, languageCode)}
                  </div>
                  <h2 className="font-headline text-2xl truncate">{sermon.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-outline/40 px-2 py-0.5 text-on-surface-variant">
                      {stateLabel(state, t)}
                    </span>
                    <span className="rounded-full border border-outline/40 px-2 py-0.5 text-on-surface-variant">
                      {publishedText}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/editor/sermons/${sermon._id}`}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                >
                  {t("proofreading.openProofreader", "Open proofreader")}
                </Link>
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

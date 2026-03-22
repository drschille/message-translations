import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LocateFixed,
  Minus,
  PlayCircle,
  Plus,
} from "lucide-react";
import { formatDate } from "@/src/lib/utils";

interface ReaderPageProps {
  sermon?: any;
  onBack: () => void;
}

const fallbackParagraphs = [
  "Velsignet være Herrens Navn. Det er en stor forrett å være her i kveld i Herrens hus. Vi ser frem til hva Herren vil gjøre iblant oss når vi åpner Hans Ord. Vi vet at Hans Ord aldri vender tomt tilbake, men det vil utrette det som Han har sendt det for å gjøre.",
  "Jeg vil at vi skal vende oss til Skriftene i kveld for å finne vårt emne. Vi lever i en tid hvor mange søker etter et hvilested, et sted for fred i en urolig verden. Men det finnes bare ett sant hvilested som Gud Selv har utvalgt.",
  "Da Salomon bygde templet, trodde han kanskje at han hadde bygget et hus for Den Høyeste. Men profeten sa: Hvilket hus vil dere bygge Meg? sier Herren. Eller hva er Min hvileplass? Jorden er Hans fotskammel og himmelen er Hans trone.",
  "Vi ser i dag at folk prøver å bygge store organisasjoner, praktfulle katedraler med glassmalerier og høye spir. De tror at Gud vil bo der. Men Gud kan ikke begrenses til menneskehenders verk. Han søker etter et tempel av kjøtt og blod, et menneske som vil tro Hans løfte for denne timen.",
  "Når vi ser på Israels historie, ser vi hvordan de alltid ønsket noe de kunne se og røre ved. De ville ha en konge som nasjonene rundt dem. Men Gud var deres Konge. De ønsket et tabernakel, men Gud ønsket å bo i deres midte gjennom Sin Ånd.",
  "I denne siste tid har Gud igjen sendt oss et budskap for å kalle oss ut av systemene og inn i det sanne hvilestedet. Det hvilestedet er i Kristus, som er Ordet. Når du tar imot Ordet for din dag, da tar du imot Gud Selv, for Ordet og Gud er ett.",
];

export default function ReaderPage({ sermon, onBack }: ReaderPageProps) {
  const [fontScale, setFontScale] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)));
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const paragraphs = useMemo(() => {
    if (!sermon?.transcript) {
      return fallbackParagraphs;
    }

    const byDoubleLine = sermon.transcript
      .split(/\n\s*\n/g)
      .map((chunk: string) => chunk.trim())
      .filter(Boolean);

    if (byDoubleLine.length > 0) {
      return byDoubleLine;
    }

    return sermon.transcript
      .split(/(?<=[.!?])\s+/)
      .map((chunk: string) => chunk.trim())
      .filter(Boolean);
  }, [sermon]);

  const increaseText = () => setFontScale((prev) => Math.min(1.3, Number((prev + 0.05).toFixed(2))));
  const decreaseText = () => setFontScale((prev) => Math.max(0.85, Number((prev - 0.05).toFixed(2))));

  const sermonTitle = sermon?.title ?? "Det Valgte Hvilested";
  const sermonDate = sermon?.date ? formatDate(sermon.date) : "13. MAI 1965";
  const sermonSeries = sermon?.series ?? "De syv segl";

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <header className="relative h-[72vh] min-h-[420px] max-h-[620px] w-full overflow-hidden flex items-end">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWpVrZzbMaXJYasclAnCxqggnKRK39BNr3-h9cTmwV4rV59pIxRcy5iZySIP_jOklAoxTgplLwm7AZ0LVb3TcZyq-J5xjgk-njURigngaPdNAR-u6piKTtL8WLDXibbXzyk0j10F4tDWAZBR1VLOsCFg2tTWHMfSt3rUNa7M4vf_q4zYgIdCzUh6sUIqHuV00kocJJ4zmLw5tT35EjikrBoPd8Oycj_72BNsist6FXtGmXey1659mZ5aT54aIZ-0BqGX2VLt5Cla5M"
          alt="Peaceful landscape"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/65 to-[#131313]/10" />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-12 md:px-8 md:pb-16">
          <button
            onClick={onBack}
            className="mb-7 inline-flex items-center gap-2 rounded-md border border-[#8d9199]/30 bg-[#1c1b1b]/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#c3c6cf] transition hover:border-[#a8c9f4]/60 hover:text-[#a8c9f4]"
          >
            <ChevronLeft size={14} />
            Tilbake
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">Sermon Archive</span>
              <span className="h-px w-12 bg-[#8d9199]/35" />
            </div>
            <h1 className="max-w-3xl font-headline text-5xl font-bold tracking-tight text-[#e5e2e1] md:text-7xl">
              {sermonTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-sm font-medium text-[#c3c6cf]">
              <span className="inline-flex items-center gap-2">
                <LocateFixed size={16} className="text-primary" />
                Jeffersonville, IN
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} className="text-primary" />
                {sermonDate}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-12 px-6 py-14 lg:grid-cols-[1fr_minmax(auto,760px)_1fr] lg:px-8">
        <aside className="hidden h-fit space-y-12 lg:sticky lg:top-20 lg:block">
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8d9199]">Lese-fremgang</div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${scrollProgress}%` }} />
            </div>
            <div className="text-xs text-[#8d9199]">{Math.round(scrollProgress)}%</div>
          </div>
        </aside>

        <article className="text-[#e5e2e1]">
          <div className="sticky top-0 z-40 mb-14 flex items-center justify-between border-y border-[#43474e]/25 bg-[#131313]/95 py-4 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-2 py-1.5">
              <button
                onClick={decreaseText}
                className="rounded-full p-2 text-[#c3c6cf] transition hover:bg-[#2a2a2a] hover:text-primary"
                aria-label="Decrease font size"
              >
                <Minus size={16} />
              </button>
              <span className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-[#8d9199]">AA</span>
              <button
                onClick={increaseText}
                className="rounded-full p-2 text-[#c3c6cf] transition hover:bg-[#2a2a2a] hover:text-primary"
                aria-label="Increase font size"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={sermon?.pdfUrl || "#"}
                target={sermon?.pdfUrl ? "_blank" : undefined}
                rel={sermon?.pdfUrl ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-md bg-surface-container px-3 py-2 text-sm font-medium transition hover:bg-surface-container-high"
              >
                <Download size={16} />
                Last ned PDF
              </a>
              <button
                onClick={() => setBookmarked((prev) => !prev)}
                className="rounded-md p-2 text-[#c3c6cf] transition hover:bg-surface-container-high hover:text-primary"
                aria-label="Bookmark sermon"
              >
                <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <div className="space-y-8" style={{ fontSize: `${fontScale}rem` }}>
            {paragraphs.map((paragraph, index) => {
              if (index === 2) {
                return (
                  <div key={`quote-${index}`} className="my-16 overflow-hidden bg-surface-container-low px-6 py-10 md:px-8 md:py-12">
                    <div className="mb-4 h-1 w-14 bg-secondary" />
                    <blockquote className="font-headline text-2xl italic leading-snug text-[#dcc2a9] md:text-4xl">
                      "Gud hviler ikke i bygninger av stein og tre, men i et hjerte som har gjort rom for Hans Ord."
                    </blockquote>
                    <cite className="mt-6 block text-xs uppercase tracking-[0.16em] text-[#8d9199]">
                      William Marrion Branham
                    </cite>
                  </div>
                );
              }

              return (
                <p
                  key={`${paragraph.slice(0, 25)}-${index}`}
                  className="leading-[1.9] text-[#e5e2e1]/90"
                  style={{ marginBottom: "2rem" }}
                >
                  {index === 0 ? (
                    <>
                      <span className="float-left mr-3 font-headline text-6xl font-bold leading-[0.9] text-primary md:text-7xl">
                        {paragraph[0]}
                      </span>
                      {paragraph.slice(1)}
                    </>
                  ) : (
                    paragraph
                  )}
                </p>
              );
            })}
          </div>
        </article>

        <aside className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <div className="rounded-lg border border-[#43474e]/20 bg-surface-container-low p-6">
            <h3 className="mb-4 font-headline text-lg text-secondary">Detaljer</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8d9199]">Serien</dt>
                <dd className="text-[#e5e2e1]">{sermonSeries}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8d9199]">Oversettelse</dt>
                <dd className="text-[#e5e2e1]">Norsk (Bokmal)</dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#8d9199]">Lydfil</dt>
                <dd>
                  <a
                    href={sermon?.audioUrl || "#"}
                    target={sermon?.audioUrl ? "_blank" : undefined}
                    rel={sermon?.audioUrl ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-2 text-primary transition hover:text-[#d1e4ff]"
                  >
                    <PlayCircle size={16} />
                    {sermon?._id || "65-0513"}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="mx-auto mt-2 w-full max-w-4xl border-t border-[#43474e]/25 px-6 py-10 md:px-8 md:py-12">
        <div className="flex items-center justify-between gap-8">
          <button
            onClick={onBack}
            className="group flex flex-col items-start gap-2 text-left"
          >
            <span className="text-xs uppercase tracking-[0.16em] text-[#8d9199] transition group-hover:text-primary">Forrige tale</span>
            <span className="inline-flex items-center gap-2 font-headline text-xl text-[#e5e2e1]">
              <ChevronLeft size={18} className="opacity-70" />
              Det ellevte bud
            </span>
          </button>

          <button
            onClick={onBack}
            className="group flex flex-col items-end gap-2 text-right"
          >
            <span className="text-xs uppercase tracking-[0.16em] text-[#8d9199] transition group-hover:text-primary">Neste tale</span>
            <span className="inline-flex items-center gap-2 font-headline text-xl text-[#e5e2e1]">
              Kraften av forvandling
              <ChevronRight size={18} className="opacity-70" />
            </span>
          </button>
        </div>
      </div>

      <footer className="border-t border-[#e5e2e1]/10 bg-[#1c1b1b] py-12">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-8 md:grid-cols-2 md:px-12">
          <div className="space-y-3">
            <div className="font-headline text-lg italic text-secondary">The Digital Archive</div>
            <p className="text-xs uppercase tracking-[0.08em] text-[#e5e2e1]/55">© 2024 The Digital Archive. Med enerett.</p>
          </div>
          <div className="flex flex-wrap gap-6 md:justify-end">
            <a className="text-xs uppercase tracking-[0.08em] text-[#e5e2e1]/45 transition hover:text-[#e5e2e1]" href="#">Retningslinjer</a>
            <a className="text-xs uppercase tracking-[0.08em] text-[#e5e2e1]/45 transition hover:text-[#e5e2e1]" href="#">Personvern</a>
            <a className="text-xs uppercase tracking-[0.08em] text-[#e5e2e1]/45 transition hover:text-[#e5e2e1]" href="#">Brukervilkar</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

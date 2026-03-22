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
import homePillarOfFire from "@/src/assets/home_pillar_of_fire.jpg";

interface FullReadModeProps {
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

export default function FullReadMode({ sermon, onBack }: FullReadModeProps) {
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
      <header className="relative flex h-[500px] w-full items-end overflow-hidden md:h-[614px]">
        <img
          src={homePillarOfFire}
          alt="William Branham with pillar of fire"
          className="absolute inset-0 h-full w-full object-cover object-top opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-12 md:px-8 md:pb-16">
          <button
            onClick={onBack}
            className="mb-7 inline-flex items-center gap-2 rounded-md border border-outline/30 bg-surface-container-low/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
          >
            <ChevronLeft size={14} />
            Tilbake
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Sermon Archive</span>
              <span className="h-px w-12 bg-outline/35" />
            </div>
            <h1 className="max-w-4xl font-headline text-4xl font-bold leading-[1.1] tracking-tight text-on-surface md:text-6xl lg:text-7xl">
              {sermonTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-6 pt-4 text-sm font-medium text-on-surface-variant">
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

      <div className="mx-auto grid w-full max-w-screen-xl gap-12 px-6 py-12 md:px-8 md:py-16 lg:grid-cols-[1fr_minmax(auto,720px)_1fr]">
        <aside className="hidden h-fit space-y-12 lg:sticky lg:top-24 lg:block">
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-outline">Lese-fremgang</div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${scrollProgress}%` }} />
            </div>
          </div>
        </aside>

        <article className="text-on-surface">
          <div className="sticky top-[72px] z-40 mb-12 flex flex-wrap items-center justify-between gap-4 border-y border-outline/20 bg-background/95 py-4 backdrop-blur-sm md:mb-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg bg-surface-container p-1">
                <button className="rounded-md bg-surface-container-high px-3 py-1.5 text-xs font-bold tracking-[0.1em] text-on-surface shadow-sm">
                  Lese-modus
                </button>
                <button className="rounded-md px-3 py-1.5 text-xs font-bold tracking-[0.1em] text-on-surface-variant hover:text-on-surface">
                  Sammenligning
                </button>
              </div>
              <div className="hidden h-6 w-px bg-outline/30 sm:block" />
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-1.5">
                <button
                  onClick={decreaseText}
                  className="rounded-full p-1 text-on-surface-variant transition hover:text-primary"
                  aria-label="Decrease font size"
                >
                  <Minus size={16} />
                </button>
                <span className="text-xs font-bold text-outline">AA</span>
                <button
                  onClick={increaseText}
                  className="rounded-full p-1 text-on-surface-variant transition hover:text-primary"
                  aria-label="Increase font size"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={sermon?.pdfUrl || "#"}
                target={sermon?.pdfUrl ? "_blank" : undefined}
                rel={sermon?.pdfUrl ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-md bg-surface-container px-4 py-2 text-sm font-medium transition hover:bg-surface-container-high"
              >
                <Download size={16} />
                Last ned PDF
              </a>
              <button
                onClick={() => setBookmarked((prev) => !prev)}
                className="rounded-md p-2 text-on-surface-variant transition hover:text-primary"
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
                  <div key={`quote-${index}`} className="group relative my-12 overflow-hidden bg-surface-container-low px-6 py-10 md:my-16 md:px-8 md:py-12">
                    <div className="absolute left-0 top-0 h-full w-1 bg-secondary" />
                    <span className="pointer-events-none absolute right-8 top-4 font-headline text-8xl text-secondary/5">"</span>
                    <blockquote className="relative z-10 font-headline text-2xl italic leading-snug text-secondary md:text-4xl">
                      "Gud hviler ikke i bygninger av stein og tre, men i et hjerte som har gjort rom for Hans Ord."
                    </blockquote>
                    <cite className="mt-6 block text-sm uppercase tracking-widest text-outline-variant">- William Marrion Branham</cite>
                  </div>
                );
              }

              return (
                <p key={`${paragraph.slice(0, 25)}-${index}`} className="leading-[1.85] text-on-surface/90" style={{ marginBottom: "2rem" }}>
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

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          <div className="rounded-lg border border-outline/15 bg-surface-container-low p-6">
            <h3 className="mb-4 font-headline text-lg text-secondary">Detaljer</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">Serien</dt>
                <dd className="text-on-surface">{sermonSeries}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">Oversettelse</dt>
                <dd className="text-on-surface">Norsk (Bokmal)</dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] uppercase tracking-wider text-outline">Lydfil</dt>
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

      <div className="mx-auto mt-2 w-full max-w-4xl border-t border-outline/20 px-6 py-12 md:px-8">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
          <button onClick={onBack} className="group flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <span className="text-xs uppercase tracking-[0.16em] text-outline transition group-hover:text-primary">Forrige tale</span>
            <span className="font-headline text-lg text-on-surface md:text-xl">Det ellevte bud</span>
          </button>

          <button onClick={onBack} className="group flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
            <span className="text-xs uppercase tracking-[0.16em] text-outline transition group-hover:text-primary">Neste tale</span>
            <span className="font-headline text-lg text-on-surface md:text-xl">Kraften av forvandling</span>
          </button>
        </div>
      </div>

      <footer className="border-t border-[#e5e2e1]/10 bg-surface-container-lowest py-12">
        <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-8 px-6 md:grid-cols-2 md:px-12">
          <div className="space-y-2 text-center md:text-left">
            <div className="text-lg font-headline italic text-secondary">The Digital Archive</div>
            <p className="text-[10px] uppercase tracking-[0.05em] text-outline">© 2024 The Digital Archive. Med enerett.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:justify-end">
            <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
              Retningslinjer
            </a>
            <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
              Personvern
            </a>
            <a className="text-[10px] uppercase tracking-[0.05em] text-outline transition hover:text-on-surface" href="#">
              Brukervilkar
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

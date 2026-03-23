import { BookOpen, Quote, CheckCircle, Play } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="pt-32 pb-20 overflow-x-hidden">
      {/* Hero Section: Intentional Asymmetry */}
      <header className="max-w-7xl mx-auto px-8 mb-32 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-7 space-y-8">
          <p className="font-label text-secondary tracking-[0.2em] uppercase text-xs">Vår Historie</p>
          <h1 className="font-headline text-5xl md:text-7xl leading-tight tracking-tighter text-on-surface">
            Bevarer et åndelig <br /> <span className="italic text-primary">testamente</span> for fremtiden.
          </h1>
          <p className="text-lg text-on-surface-variant max-w-xl leading-relaxed font-light">
            Branham.no er dedikert til å arkivere, oversette og dele det profetiske budskapet gitt til William Marrion Branham. Vi søker å presentere disse sannhetene med den verdighet og klarhet de fortjener.
          </p>
        </div>
        <div className="md:col-span-5 relative">
          <div className="aspect-[4/5] bg-surface-container-high overflow-hidden rounded-lg shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
            <img 
              alt="Gammel bok i et bibliotek" 
              className="w-full h-full object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-700" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQhLdUo2BwOVHQPgv0bNOSHx9A3PakXcTjVlSgN0jDfThwtNvVAZ3LU1vBZX5oiiwNgIJP2hrfwFRit9KrZRV0GICtJQ4POyJ_0_7bevyNyLzY3-svnjBHivZ1W0MkyjtXimintO6-ToMC4jSX86zm2htiCO89DVp-lMnmn6cCQ4MCMhJ14h2MNNPdfayrcT59kxsowzzT2TBkHlPPkyaNz8pfSpj97MnSg7sKhG3Wv3_SBGuq47OStqr1t9JEVu4gfIvMBuQFwMlc"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 bg-secondary/30 p-8 rounded-lg hidden lg:block">
            <BookOpen className="text-4xl text-secondary" size={48} />
          </div>
        </div>
      </header>

      {/* Mission Statement: The Quote Block */}
      <section className="bg-surface-container-low py-32 mb-32 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
          <span className="text-[20rem] font-headline">B</span>
        </div>
        <div className="max-w-4xl mx-auto px-8 text-center space-y-8 relative z-10">
          <Quote className="text-secondary mx-auto" size={48} />
          <blockquote className="font-headline text-3xl md:text-4xl leading-snug text-on-surface">
            "Tro er å gripe tak i Guds usynlige ressurser og bringe dem inn i den synlige verden for å møte behovet."
          </blockquote>
          <div className="h-px w-24 bg-secondary/30 mx-auto"></div>
          <p className="font-label text-secondary tracking-widest uppercase text-sm">Vår Misjon</p>
        </div>
      </section>

      {/* Timeline: Editorial Layout */}
      <section className="max-w-7xl mx-auto px-8 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="font-headline text-4xl sticky top-40">Milepæler <br /> <span className="text-primary-container">Øyeblikk</span></h2>
          </div>
          <div className="md:col-span-8 space-y-24">
            {/* Event 1 */}
            <div className="group grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="font-headline text-5xl text-surface-container-highest group-hover:text-secondary transition-colors duration-500">1909</div>
              <div className="md:col-span-3 space-y-4">
                <h3 className="text-xl font-bold text-on-surface">Begynnelsen</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  William Marrion Branham blir født i en liten tømmerhytte i Kentucky. En ydmyk start på et liv som skulle påvirke millioner over hele verden gjennom en unik tjeneste.
                </p>
              </div>
            </div>
            {/* Event 2 */}
            <div className="group grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="font-headline text-5xl text-surface-container-highest group-hover:text-secondary transition-colors duration-500">1946</div>
              <div className="md:col-span-3 space-y-4">
                <h3 className="text-xl font-bold text-on-surface">Vindens Røst</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  Starten på de store helbredelseskampanjene som feide over Nord-Amerika og senere verden, og som markerte begynnelsen på den moderne karismatiske vekkelsen.
                </p>
              </div>
            </div>
            {/* Event 3 */}
            <div className="group grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="font-headline text-5xl text-surface-container-highest group-hover:text-secondary transition-colors duration-500">2024</div>
              <div className="md:col-span-3 space-y-4">
                <h3 className="text-xl font-bold text-on-surface">Digital Bevaring</h3>
                <p className="text-on-surface-variant leading-relaxed">
                  Branham.no fortsetter arbeidet med å digitalisere og oversette arkivene til norsk, slik at budskapet forblir tilgjengelig for den nye generasjonen av troende.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brief Biography: Bento Grid Style */}
      <section className="max-w-7xl mx-auto px-8 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-surface-container p-12 rounded-xl flex flex-col justify-end min-h-[400px] relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20 group-hover:scale-105 transition-transform duration-700">
              <img 
                alt="Tåket landskap i fjellet" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWAyXY2NTWbJ1zL2EodNQk9Qu7goaxnCXO5O1Dkb2E-EfNseZ1c6xVJLDkoYLNKtz8A1Amn7CJkXmftBMGqMJiKefA0HFzspoTY9L4xBZ_VdirT-3oLtC2g4qh0Ef1h4NQ7vbtNupucOXNWk2CrPxDO9DRoNe12f7327rkZi4reFDaej753J8hUf_MtSLzejg6FmJO_n7CGpqA8Sn0GnM3cWuGYP54y5PQtSmjpGUVVWRgCjWdzu5HFKRxY8_ntpR3KQTZQo2m_okR"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="relative z-10 space-y-4">
              <h3 className="font-headline text-3xl">Livet i Tjenesten</h3>
              <p className="text-on-surface-variant max-w-lg">
                William Branhams liv var preget av overnaturlige opplevelser fra barndommen av, noe som formet hans dype forståelse for det åndelige og Guds ord.
              </p>
            </div>
          </div>
          <div className="bg-secondary/30 p-12 rounded-xl flex flex-col justify-between">
            <BookOpen className="text-5xl text-secondary" size={48} />
            <div className="space-y-4">
              <h3 className="font-headline text-2xl text-secondary">Arkivet</h3>
              <p className="text-sm text-secondary/80 leading-relaxed">
                Over 1100 taler er tatt opp på bånd, og danner grunnlaget for det vi i dag oversetter og formidler.
              </p>
            </div>
          </div>
          <div className="bg-surface-container-high p-12 rounded-xl space-y-6 md:order-last">
            <h3 className="font-headline text-2xl">Vår Tilnærming</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <CheckCircle className="text-primary mt-1" size={16} />
                <span className="text-sm text-on-surface-variant">Nøyaktig oversettelse fra originalkilder.</span>
              </li>
              <li className="flex items-start gap-4">
                <CheckCircle className="text-primary mt-1" size={16} />
                <span className="text-sm text-on-surface-variant">Respekt for den opprinnelige konteksten.</span>
              </li>
              <li className="flex items-start gap-4">
                <CheckCircle className="text-primary mt-1" size={16} />
                <span className="text-sm text-on-surface-variant">Fri tilgang for alle søkende hjerter.</span>
              </li>
            </ul>
          </div>
          <div className="md:col-span-2 aspect-video bg-surface-container-lowest rounded-xl overflow-hidden relative group">
            <img 
              alt="En person som skriver i en notatbok" 
              className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBM0g81Yvk4rfatKMvmVMwp1YmG-4slArs7M9TTaimFdyES7ifqE8k6qzLT79TIBhWCj87UgNC2sW8AnMD4mwKytSbUQc07SEYqlhYzanfW2lXTgMniEhBZG9ag6pGo9_zgV79ZURiuh-yiRCmv5ryjeE3MGJn9afm32ZBl39LYHGdnvL0RyV_3I6p5NxDFpCD7XWd0vxOaKds__-OoPbmvYwRXAAemaVuCBSMmYosQHFvS-IJgmc45qrs7SRaeQifLONAFtxuDfPRT"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-3 rounded-full flex items-center gap-3 hover:bg-white/20 transition-all">
                <Play size={16} />
                <span className="font-label uppercase tracking-widest text-xs">Se Introduksjonsvideo</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

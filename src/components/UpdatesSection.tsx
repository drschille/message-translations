import { useTranslation } from "react-i18next";

export default function UpdatesSection() {
  const { t } = useTranslation();
  const updates = [
    {
      tag: "ARKIV NYTT",
      title: "Nye oversettelser fra 1963-serien",
      desc: "Vi har lagt til tre nye taler fra den historiske serien i Arizona, nå fullstendig oversatt til norsk.",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1aAo8ZjLl8HoVDr0XQvmLZoyVlytHkfbdyI8WJpoG84RPGhf001inSPmduy2VFSzSWOT-OljVfeNpL3GtkMSgiYJSVtXJ1IhLhReVp8E55calpSDXQUTp6PobnKGHLT2bzCGM5FUSVHFWqhtMbrwN4Y5SZ5Jg96QM3cbo4fF-HgnbNzdlhdf-aYTMCRlJILYqGAyq-N0UWLftfnsZn9Iv3AETZivH_tAyOj77ycuCS1xq6hzN-6BEZal2D027MyHROMpm0l3bY3pM"
    },
    {
      tag: "RESSURSER",
      title: "Digitalt studiebibliotek lansert",
      desc: "Vårt nye grensesnitt for kryssreferanser mellom Bibelen og budskapet er nå live.",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4805kp6cJwaj_F8scDkH9ZosnHiXPvuZZj_7v8btOM-M2LerWKMpdGCjsNJZc3aOHOnTkYLb-TS5GjZMHYmnWJxAcazK5Ei8HweK6dKxRSKiGzQIfr97TCleotk4dOPnOt49n12Wxgz3IeDbOTsKVC1PzuzvnjlgCReYeQfBhdGsb8ETVmv23n5bij3COT0cpqCbKSAj3y3D21rgzSOkS4iqpU1vzl15td62-4n6TGcJlhkp-7KnvWvsT6ozZ2Mu65xqTRcrB9VTS"
    },
    {
      tag: t('common.events'),
      title: "Oversettelsesmøte i Oslo",
      desc: "Bli med oss for en gjennomgang av oversettelsesarbeidet og fellesskap rundt ordet.",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAV4vhsVCaWwZUHe4OMLT5Wb4oPmMLHOUUFqeiL3lMepnpgxn2XP1-3OVALqtMDH6qaH9jWjTdwdVPjoIjPSlWGobVtQWEIgs8fHZsv9EmawHA9sFmyyPTXe8if5mNWj3Fuv2IxpNoRUdsw5K-WJrDHEFu89Zt8zehPBDVoEBBgge3thfsLInPtuwQSBDR2logndg0cM7gS7dGzEXqd6nqf7Beejbuc74uc2wjV3F4FIedIyo0me1SnpWT_uJ7YVjhaX6alPMJWX9S5"
    }
  ];

  return (
    <section className="py-32 bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-headline text-on-surface mb-4">Siste oppdateringer</h2>
          <div className="h-1 w-20 bg-primary mx-auto"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {updates.map((update, idx) => (
            <div key={idx} className="space-y-6 group">
              <div className="aspect-video bg-surface-container rounded-lg overflow-hidden">
                <img 
                  className="w-full h-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                  alt={update.title} 
                  src={update.img}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="text-xs text-secondary font-bold tracking-widest uppercase">{update.tag}</span>
                <h4 className="text-xl font-headline mt-2 text-on-surface">{update.title}</h4>
                <p className="text-on-surface-variant text-sm mt-4 leading-relaxed">{update.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

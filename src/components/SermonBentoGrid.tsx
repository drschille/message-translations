import { ChevronRight, Calendar, MapPin, BookOpen, Mic, Search as SearchIcon, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

export default function SermonBentoGrid() {
  return (
    <section className="py-32 bg-surface">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl font-headline text-on-surface mb-6">Taler oversatt til norsk</h2>
            <p className="text-on-surface-variant text-lg">En voksende samling av budskap tilgjengelig i tekst og lydformat, nøye oversatt for å bevare den opprinnelige ånden.</p>
          </div>
          <a className="text-secondary hover:text-primary transition-colors flex items-center gap-2 font-medium tracking-wide" href="#">
            SE ALLE TALER <ChevronRight size={18} />
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Featured Sermon */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-8 group relative overflow-hidden rounded-xl bg-surface-container aspect-video flex items-end p-8 transition-all hover:bg-surface-container-high"
          >
            <div className="absolute inset-0 z-0 transition-transform duration-700 group-hover:scale-105 opacity-40">
              <img 
                className="w-full h-full object-cover grayscale" 
                alt="Ancient open book" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDF8Cwje0Udf6bZa3ZEBf9hR8P5hCx5FqRxt1DQlbC2cbvSYdXec7kFbFVCyUYp91OkFInWbx6PNnwedUzr32dcxzPERMsX6kSL8RPQW1SH9IOzyUxzFS_mNiLKwK1BeF_ORP1STsLDNkEbUYXDGgzt1ZcS-b2k2MgTUnd4ehNtzAzHk56EgwbuU_S86vzSNw7WujE3GF5wKwhv_B3mxlrgGcycIE37YqJoWxu44OHUwxZNvievrHJ27Oo5Em4ngPwqKwqagxnajwjz"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/20 to-transparent"></div>
            </div>
            <div className="relative z-10 w-full">
              <span className="text-xs font-bold text-primary tracking-widest uppercase mb-2 block">SISTE OVERSETTELSE</span>
              <h3 className="text-3xl font-headline text-on-surface mb-4">Det glemte budskapet</h3>
              <div className="flex items-center gap-6 text-on-surface-variant text-sm">
                <span className="flex items-center gap-1"><Calendar size={14} /> 12. Jan 1961</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> Jeffersonville, IN</span>
              </div>
            </div>
          </motion.div>

          {/* Side Card 1 */}
          <div className="md:col-span-4 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between hover:bg-surface-container-high transition-all">
            <div>
              <BookOpen className="text-secondary mb-6" size={40} />
              <h3 className="text-xl font-headline text-on-surface mb-4">Bibliotek</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Bla gjennom kategoriserte serier og temaer fra de tidlige årene til slutten av tjenesten.</p>
            </div>
            <a className="mt-8 text-primary flex items-center gap-2 text-sm font-semibold" href="#">LES MER <ArrowUpRight size={16} /></a>
          </div>

          {/* Side Card 2 */}
          <div className="md:col-span-4 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between hover:bg-surface-container-high transition-all">
            <div>
              <Mic className="text-secondary mb-6" size={40} />
              <h3 className="text-xl font-headline text-on-surface mb-4">Lydopptak</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Hør de originale opptakene mens du leser den norske oversettelsen side om side.</p>
            </div>
            <a className="mt-8 text-primary flex items-center gap-2 text-sm font-semibold" href="#">LYTT NÅ <ArrowUpRight size={16} /></a>
          </div>

          {/* Large Static Content */}
          <div className="md:col-span-8 bg-surface-container-highest/30 rounded-xl p-12 flex flex-col md:flex-row items-center gap-12 border border-outline-variant/10">
            <div className="flex-1">
              <h3 className="text-2xl font-headline text-on-surface mb-4">Søkbart arkiv</h3>
              <p className="text-on-surface-variant leading-relaxed">Finn spesifikke emner eller skriftsteder i alle oversatte taler med vårt avanserte søkeverktøy.</p>
            </div>
            <div className="relative w-full md:w-64 h-32 bg-surface-container-low rounded-lg border border-outline-variant/20 flex items-center px-6">
              <span className="text-on-surface-variant italic">Søk etter 'Syv Segl'...</span>
              <SearchIcon className="absolute right-4 text-primary" size={20} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

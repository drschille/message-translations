import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          className="w-full h-full object-cover object-center md:object-right opacity-60 grayscale" 
          alt="Monochromatic portrait of William Marrion Branham" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD25zDVXAZ_A1O0HUJHWHuHo4hQpvoT08glKj5GCjjbmSVRgwZhDQeV8FCCHNxvcWLSba-stWWOGyZRj4HJiNHSj1BnWpGi-HnpLsUL61Q6gaNTwCk-2x9OYcXMRidZEjxZFIFcPh8QFNPd76vskskOUr-QpOIi5PgjpaFwqZpmce9avXjTtuRF_1PSgHcAvevlbM-iX0Eg62exV9qDFZItaUNYl0l9s9cCuS1-HSL4xCLF2_J8qUBJ_3A_bpQqRBRlhAbB6bKTJyaR"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 hero-gradient"></div>
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-8 w-full">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-block text-secondary tracking-[0.2em] mb-4 font-semibold uppercase text-xs">Digitalt Arkiv</span>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline font-bold text-on-surface leading-tight tracking-tighter mb-8">
            Et vitnesbyrd <br/><span className="text-primary italic font-normal">for vår tid</span>
          </h1>
          <p className="text-lg md:text-xl text-on-surface-variant max-w-lg mb-12 leading-relaxed font-light">
            Velkommen til det norske arkivet for William Marrion Branhams tjeneste. Utforsk taler, historie og budskapet oversatt for norske troende.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="button-metallic px-8 py-4 rounded-md text-on-primary font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              Utforsk Taler
              <ArrowRight size={20} />
            </button>
            <button className="px-8 py-4 rounded-md border border-on-surface/10 text-on-surface hover:bg-surface-container-highest transition-colors font-medium">
              Om Broder Branhams tjeneste
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

import { motion } from "motion/react";

export default function AboutSection() {
  return (
    <section className="py-32 bg-surface overflow-hidden">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-1/2 relative">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative z-10 rounded-xl overflow-hidden shadow-2xl"
            >
              <img 
                className="w-full aspect-4/5 object-cover grayscale brightness-75 hover:scale-105 transition-transform duration-1000" 
                alt="Norwegian landscape" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbWJtnSxkQcCUdAMdtVkW8zUAHpRBjrIbvQVumT5tyKI6g-FNs58MX_zyd0HST3E5x3_wMIxX1ZE4Qz7PrWJBTgmsYPUFeZdRySqzRh9RKdbFeoRgmArxnC7kIB3ARxyckVjGJ-HRXa1gBSg2wZXjMoQnqpSD6z1pAK_be43qZ0eFuK9CCIy61YOUnQW5Hz5HxYKxuNcfBs74xMLJAnhrck0ayHL0oC8cqg7nWwyOpY9cfMBj13cTZSDX6G6MRcf7li_6MsClTaRrX"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl"></div>
          </div>
          <div className="lg:w-1/2">
            <span className="text-secondary tracking-widest mb-6 block font-semibold uppercase text-xs">VÅR MISJON</span>
            <h2 className="text-4xl md:text-6xl font-headline text-on-surface mb-8 leading-tight">Hvem er vi?</h2>
            <div className="space-y-6 text-on-surface-variant text-lg leading-relaxed font-light">
              <p>Vi er en uavhengig gruppe troende i Norge som er dedikert til å bevare og distribuere budskapet brakt av William Branham.</p>
              <p>Gjennom nøyaktig oversettelse og moderne tilgjengelighet ønsker vi å gjøre disse tidløse sannhetene tilgjengelige for alle norskspråklige som søker et dypere kristent liv.</p>
              <p>Vårt arbeid er basert på frivillighet og en dyp respekt for det profetiske ordet som ble talt.</p>
            </div>
            <div className="mt-12">
              <button className="px-10 py-4 border border-secondary text-secondary hover:bg-secondary hover:text-on-secondary transition-all rounded-md font-semibold">
                Kontakt oss
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

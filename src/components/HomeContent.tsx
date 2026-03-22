import { motion } from "motion/react";
import Hero from "./Hero";
import SermonBentoGrid from "./SermonBentoGrid";
import QuoteBlock from "./QuoteBlock";
import AboutSection from "./AboutSection";
import UpdatesSection from "./UpdatesSection";

export default function HomeContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Hero />
      <SermonBentoGrid />
      <QuoteBlock />
      <AboutSection />
      <UpdatesSection />
    </motion.div>
  );
}

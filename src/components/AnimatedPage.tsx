import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AnimatedPageProps {
  children: ReactNode;
  direction?: "x" | "y";
}

const scrollPositions = new Map<string, number>();

export default function AnimatedPage({ children, direction = "x" }: AnimatedPageProps) {
  const initial = direction === "y" ? { opacity: 0, y: 20 } : { opacity: 0, x: 20 };
  const exit = direction === "y" ? { opacity: 0, y: -20 } : { opacity: 0, x: -20 };
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      scrollPositions.set(pathnameRef.current, window.scrollY);
    };
  }, []);

  // Restore scroll position if previously visited, otherwise scroll to top.
  // Poll until the document is tall enough, since async data may not be
  // rendered yet when this effect first runs.
  useEffect(() => {
    const saved = scrollPositions.get(pathname);
    if (!saved) {
      window.scrollTo(0, 0);
      return;
    }

    let frame: number;
    let attempts = 0;

    const tryScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable >= saved || attempts >= 60) {
        window.scrollTo(0, saved);
        return;
      }
      attempts++;
      frame = requestAnimationFrame(tryScroll);
    };

    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={exit}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

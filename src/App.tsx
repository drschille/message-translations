import { Routes, Route, useLocation } from "react-router";
import { AnimatePresence } from "motion/react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import HomeContent from "./components/HomeContent";
import AboutPage from "./components/AboutPage";
import TranslationsPage from "./components/TranslationsPage";
import ReaderPage from "./components/ReaderPage";
import AnimatedPage from "./components/AnimatedPage";

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <AnimatedPage><HomeContent /></AnimatedPage>
          } />
          <Route path="/sermons" element={
            <AnimatedPage><TranslationsPage /></AnimatedPage>
          } />
          <Route path="/sermons/:sermonId" element={
            <AnimatedPage direction="y"><ReaderPage /></AnimatedPage>
          } />
          <Route path="/about" element={
            <AnimatedPage><AboutPage /></AnimatedPage>
          } />
        </Routes>
      </AnimatePresence>
      <Footer />
      <BottomNav />
    </div>
  );
}

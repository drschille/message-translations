import { useState } from "react";
import { ChevronDown, BookOpen, Download, Play } from "lucide-react";
import { Link } from "react-router";
import { cn, formatDate } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface SermonItemProps {
  sermon: any;
}

export default function SermonItem({ sermon }: SermonItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="group bg-surface-container-low hover:bg-surface-container transition-all duration-300 overflow-hidden">
      <div
        className="flex items-center justify-between p-6 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-8">
          <span className="text-secondary font-label tracking-widest text-xs uppercase opacity-70">
            {formatDate(sermon.date)}
          </span>
          <h3 className="text-xl font-headline font-medium text-on-surface group-hover:text-primary transition-colors">
            {sermon.title}
          </h3>
        </div>
        <ChevronDown
          className={cn(
            "text-on-surface/30 group-hover:text-on-surface transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
          size={24}
          strokeWidth={1.5}
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-8 pt-2 border-t border-on-surface/5">
              <p className="text-on-surface-variant font-body leading-relaxed max-w-2xl mb-8">
                {sermon.description}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/sermons/${sermon._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-linear-to-tr from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-md font-label text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <BookOpen size={16} />
                  Les Tekst
                </Link>
                <button className="bg-surface-container-highest text-on-surface px-6 py-2.5 rounded-md font-label text-sm font-semibold flex items-center gap-2 hover:bg-[#584633]/30 transition-colors">
                  <Download size={16} />
                  Last Ned
                </button>
                <button className="bg-surface-container-highest text-on-surface px-6 py-2.5 rounded-md font-label text-sm font-semibold flex items-center gap-2 hover:bg-[#584633]/30 transition-colors">
                  <Play size={16} />
                  Lytt
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

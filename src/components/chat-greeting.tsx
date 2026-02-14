"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipWords } from "ui/flip-words";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { BasicUser } from "app-types/user";
import { fetcher } from "lib/utils";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import {
  Sparkles,
  Globe,
  Code,
  Image,
  FileText,
  Lightbulb,
  Pencil,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

const SUGGESTION_CARDS = [
  {
    icon: Code,
    title: "Write Code",
    description: "Generate, debug, or explain code",
    prompt: "Help me write a function that ",
    gradient: "from-violet-500/20 to-purple-600/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Image,
    title: "Create Image",
    description: "Generate or edit images with AI",
    prompt: "Generate an image of ",
    gradient: "from-pink-500/20 to-rose-600/20",
    iconColor: "text-pink-400",
  },
  {
    icon: FileText,
    title: "Summarize",
    description: "Summarize documents & articles",
    prompt: "Summarize the following: ",
    gradient: "from-blue-500/20 to-cyan-600/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm",
    description: "Generate ideas & concepts",
    prompt: "Help me brainstorm ideas for ",
    gradient: "from-amber-500/20 to-yellow-600/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Pencil,
    title: "Write Content",
    description: "Blog posts, emails, essays",
    prompt: "Write a compelling ",
    gradient: "from-emerald-500/20 to-green-600/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: MessageSquare,
    title: "Explain",
    description: "Break down complex topics",
    prompt: "Explain in simple terms: ",
    gradient: "from-orange-500/20 to-red-600/20",
    iconColor: "text-orange-400",
  },
];

export const ChatGreeting = ({
  onSuggestionClick,
}: {
  onSuggestionClick?: (prompt: string) => void;
}) => {
  const { data: user } = useSWR<BasicUser>(`/api/user/details`, fetcher, {
    revalidateOnMount: false,
  });
  const t = useTranslations("Chat.Greeting");
  const [autonomousMode, webAgentMode] = appStore(
    useShallow((state) => [state.autonomousMode, state.webAgentMode]),
  );

  const word = useMemo(() => {
    if (!user?.name) return "";
    const words = [
      t(getGreetingByTime(), { name: user.name }),
      t("niceToSeeYouAgain", { name: user.name }),
      t("whatAreYouWorkingOnToday", { name: user.name }),
      t("letMeKnowWhenYoureReadyToBegin"),
      t("whatAreYourThoughtsToday"),
      t("whereWouldYouLikeToStart"),
      t("whatAreYouThinking", { name: user.name }),
    ];
    return words[Math.floor(Math.random() * words.length)];
  }, [user?.name]);

  // ─── Slider state ──────────────────────────────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = sliderRef.current;
    if (!el) return;
    const scrollAmount = 240;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  return (
    <motion.div
      key="welcome"
      className="max-w-2xl mx-auto w-full flex flex-col items-center px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
    >
      {/* Greeting */}
      <div className="rounded-xl p-6 flex flex-col gap-3 leading-relaxed text-center w-full">
        <h1 className="text-2xl md:text-3xl font-medium">
          {word ? <FlipWords words={[word]} className="text-primary" /> : ""}
        </h1>
        {autonomousMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>
              Auto mode is on — just type anything and I&apos;ll figure out the
              rest
            </span>
          </motion.div>
        )}
        {webAgentMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Globe className="size-3.5 text-emerald-500" />
            <span>
              Web Agent is active — I can search, browse, scrape, and research
              anything on the internet
            </span>
          </motion.div>
        )}
      </div>

      {/* Suggestion Slider — 3:1 aspect ratio cards */}
      <motion.div
        className="w-full mt-4 relative group"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-full px-1.5 flex items-center
                       bg-gradient-to-r from-background via-background/80 to-transparent
                       transition-opacity duration-200"
            aria-label="Scroll left"
          >
            <div className="rounded-full p-1.5 bg-muted/80 backdrop-blur border border-border/50 hover:bg-muted transition-colors shadow-sm">
              <ChevronLeft className="size-4 text-foreground/70" />
            </div>
          </button>
        )}

        {/* Cards container */}
        <div
          ref={sliderRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-none px-1 py-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {SUGGESTION_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.08, duration: 0.35 }}
                onClick={() => onSuggestionClick?.(card.prompt)}
                className={`
                  group/card flex-shrink-0 snap-start rounded-xl
                  bg-gradient-to-br ${card.gradient}
                  border border-border/30 hover:border-primary/30
                  backdrop-blur-sm cursor-pointer
                  transition-all duration-300 ease-out
                  hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/5
                  text-left
                `}
                style={{ width: "210px", aspectRatio: "3 / 1" }}
              >
                <div className="flex items-center gap-3 h-full px-4">
                  <div
                    className={`size-9 rounded-lg bg-background/40 flex items-center justify-center shrink-0 ${card.iconColor}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/90 group-hover/card:text-foreground transition-colors truncate">
                      {card.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-full px-1.5 flex items-center
                       bg-gradient-to-l from-background via-background/80 to-transparent
                       transition-opacity duration-200"
            aria-label="Scroll right"
          >
            <div className="rounded-full p-1.5 bg-muted/80 backdrop-blur border border-border/50 hover:bg-muted transition-colors shadow-sm">
              <ChevronRight className="size-4 text-foreground/70" />
            </div>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

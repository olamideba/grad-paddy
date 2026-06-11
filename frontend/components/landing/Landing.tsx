"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  GraduationCap,
  Sparkles,
  Search,
  Star,
  Calendar,
  FileText,
  ArrowRight,
  MessageSquare,
  Brain,
  Check,
  Rocket,
  X,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/context/AuthContext";
import Starfield from "./Starfield";
import CursorGlow from "./CursorGlow";

const GITHUB_URL = "https://github.com/olamideba/grad-paddy";

type Member = {
  name: string;
  role: string;
  initials: string;
  linkedin: string;
  glow: string;
  bio: string;
  pos: { top: string; left: string };
};

const TEAM: Member[] = [
  {
    name: "David Adisa",
    role: "Frontend · Backend Engineer",
    initials: "DA",
    linkedin: "https://www.linkedin.com/in/david-adisa-b09710208",
    glow: "#4ecdc4",
    bio: "Builds the interface and the systems behind it — from the agent chat to the application tracker.",
    pos: { top: "12%", left: "18%" },
  },
  {
    name: "Olamide Balogun",
    role: "Backend · AI Engineer",
    initials: "OB",
    linkedin: "https://linkedin.com/in/olamideba",
    glow: "#e8472a",
    bio: "Architects the multi-step agent, retrieval, and the human-in-the-loop pipeline that keeps it safe.",
    pos: { top: "46%", left: "58%" },
  },
  {
    name: "Firdous Bakare",
    role: "AI Engineer",
    initials: "FB",
    linkedin: "https://www.linkedin.com/in/firdous-bakare-3b74ab23a",
    glow: "#fbd530",
    bio: "Trains the agent's reasoning and grounding so its faculty matches and drafts actually hold up.",
    pos: { top: "16%", left: "72%" },
  },
];

const FLIP_CARDS = [
  {
    icon: Search,
    problemTitle: "Faculty hunting",
    problemDesc:
      "Scanning 50+ pages for a professor who may not even be taking students this cycle.",
    solutionTitle: "Ranked by fit",
    solutionDesc:
      "Agent surfaces faculty by research match, grant activity, and open-position signals — in one chat.",
    glow: "#4ecdc4",
  },
  {
    icon: Star,
    problemTitle: "Fake funding",
    problemDesc: "'Fully funded' that means a 20% waiver and a prayer for the rest.",
    solutionTitle: "Real funding only",
    solutionDesc:
      "Filter for genuine offers — RA/TA stipends, fellowships, nationality eligibility all checked.",
    glow: "#fbd530",
  },
  {
    icon: FileText,
    problemTitle: "Blank SOP page",
    problemDesc:
      "Writer's block on every application. The same weak story told a dozen different ways.",
    solutionTitle: "Drafted for you",
    solutionDesc:
      "SOPs grounded in your CV and the lab's own research — tailored per application, not templated.",
    glow: "#e8472a",
  },
  {
    icon: Calendar,
    problemTitle: "12-tab chaos",
    problemDesc:
      "Deadlines, portals, recommenders — scattered everywhere. One missed click ruins it.",
    solutionTitle: "One tracker",
    solutionDesc:
      "Every deadline, document, and recommender in one place — synced to Google Calendar.",
    glow: "#4ecdc4",
  },
  {
    icon: MessageSquare,
    problemTitle: "Cold email void",
    problemDesc: "Generic outreach that gets ignored. No idea when or whether to follow up.",
    solutionTitle: "Personal & sent",
    solutionDesc:
      "Drafts grounded in the professor's latest work. You approve — then the agent sends.",
    glow: "#fbd530",
  },
  {
    icon: Brain,
    problemTitle: "Analysis paralysis",
    problemDesc: "Comparing 40 programs for months, building spreadsheets, applying to none.",
    solutionTitle: "Next move, clear",
    solutionDesc:
      "Agent reads your fit, funding odds, and deadlines — surfaces your three best next actions.",
    glow: "#e8472a",
  },
];

const STEPS = [
  {
    Icon: Search,
    n: "01",
    title: "Research",
    desc: "Describe your interests — the agent scans the web and admissions data to surface faculty and programs that fit.",
    glow: "#4ecdc4",
  },
  {
    Icon: Star,
    n: "02",
    title: "Shortlist",
    desc: "Save the best matches with fit scores and open-position signals. Your personal admissions CRM.",
    glow: "#e8472a",
  },
  {
    Icon: Calendar,
    n: "03",
    title: "Track",
    desc: "Every deadline, SOP, CV, and recommender in one tracker that syncs to Google Calendar.",
    glow: "#4ecdc4",
  },
  {
    Icon: FileText,
    n: "04",
    title: "Draft",
    desc: "Generate statements of purpose and outreach grounded in your profile — review, edit, send.",
    glow: "#fbd530",
  },
];

// ── motion helpers ─────────────────────────────────────────────────────────────
type Dir = "up" | "down" | "left" | "right" | "scale";

const OFFSETS: Record<Dir, { x?: number; y?: number; scale?: number }> = {
  up: { y: 36 },
  down: { y: -36 },
  left: { x: 48 },
  right: { x: -48 },
  scale: { scale: 0.88 },
};

// Reveals children as they scroll into view. `dir` controls the entrance vector.
function Reveal({
  children,
  delay = 0,
  dir = "up",
  className,
}: {
  children: ReactNode;
  delay?: number;
  dir?: Dir;
  className?: string;
}) {
  const from = OFFSETS[dir];
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...from }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Scroll-scrubbed scale: oversized while the element is still below the fold,
// easing down to its natural size as it reaches the centre of the viewport.
function ScaleIn({
  children,
  scrollRef,
  from = 1.28,
  className,
}: {
  children: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
  from?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    container: scrollRef,
    target: ref,
    offset: ["start end", "center center"],
  });
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [from, 1]), {
    stiffness: 90,
    damping: 22,
  });
  const opacity = useTransform(scrollYProgress, [0, 0.55], [0.25, 1]);
  return (
    <motion.div ref={ref} style={{ scale, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

// Weightless bob — drifts continuously on a slow loop.
function Float({
  children,
  x = 10,
  y = 14,
  dur = 6,
  className,
}: {
  children: ReactNode;
  x?: number;
  y?: number;
  dur?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -y, 0, y, 0], x: [0, x, 0, -x, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

// Magnetic pull — the element accelerates toward the cursor while hovered.
function Magnetic({
  children,
  strength = 0.5,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 200, damping: 15 });
  const y = useSpring(my, { stiffness: 200, damping: 15 });
  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - (r.left + r.width / 2)) * strength);
    my.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    mx.set(0);
    my.set(0);
  }
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x, y }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  // Logged-in users go straight to the app; everyone else signs in first.
  const cta = user ? "/chat" : "/login";
  // The app's <body> is overflow-hidden, so the landing owns its own scroll —
  // and the scroll-linked animations track this container, not the window.
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={scrollRef}
      className="relative h-screen w-full overflow-y-auto overflow-x-hidden font-space text-white md:cursor-none"
      style={{ background: "#05060f" }}
    >
      <Starfield className="fixed inset-0 h-full w-full" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(232,71,42,0.18), transparent 45%), radial-gradient(circle at 80% 60%, rgba(78,205,196,0.12), transparent 40%)",
        }}
      />
      {/* Planet rides the scroll on an elliptical spiral; clipped so it never
          spills past the viewport and triggers a horizontal scrollbar. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <ScrollPlanet scrollRef={scrollRef} />
      </div>
      <CursorGlow />
      <div className="relative z-10">
        <Navbar cta={cta} />
        <Hero cta={cta} scrollRef={scrollRef} />
        <Demo scrollRef={scrollRef} />
        <Problems />
        <HowItWorks />
        <Team />
        <Footer cta={cta} />
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ cta }: { cta: string }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 px-3 sm:px-5 py-3">
      <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3 sm:px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 mr-auto">
          <span
            className="size-9 grid place-items-center border-[3px] border-white bg-[#ff4500]"
            style={{ boxShadow: "0 0 18px rgba(255,69,0,0.7)" }}
          >
            <Icon icon="solar:diploma-bold" width={18} className="text-white" />
          </span>
          <span className="font-extrabold text-lg font-syne tracking-tight">GRAD PADDY</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <a href="#demo" className="hover:text-white transition-colors">
            Demo
          </a>
          <a href="#problems" className="hover:text-white transition-colors">
            Why it exists
          </a>
          <a href="#how" className="hover:text-white transition-colors">
            How it works
          </a>
          <a href="#team" className="hover:text-white transition-colors">
            Team
          </a>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:grid size-9 place-items-center rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
          aria-label="GitHub"
        >
          <Icon icon="mdi:github" width={18} />
        </a>
        <Magnetic strength={0.3}>
          <Link
            href={cta}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-white text-[#05060f] px-3 sm:px-4 py-2 text-sm font-bold hover:shadow-[0_0_24px_rgba(78,205,196,0.7)] transition-shadow"
          >
            Try it free
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Magnetic>
      </div>
    </nav>
  );
}

// ── Glowing planet ──────────────────────────────────────────────────────────────
// Rides the whole-page scroll on an elliptical spiral: it sweeps left↔right while
// descending, shrinks into the distance, and retraces the path on scroll-up.
// Springs give it a weightless, lagging drift.
function ScrollPlanet({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const spring = { stiffness: 60, damping: 20, mass: 1.1 };

  // Horizontal sweep across the viewport — multiple lobes = the spiral.
  const xRaw = useTransform(
    scrollYProgress,
    [0, 0.2, 0.4, 0.6, 0.8, 1],
    ["0vw", "26vw", "-26vw", "24vw", "-22vw", "8vw"]
  );
  // Vertical descent down the page and back.
  const yRaw = useTransform(scrollYProgress, [0, 1], ["-4vh", "58vh"]);
  // Recede into the distance.
  const scaleRaw = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.62, 0.5]);
  const rotateRaw = useTransform(scrollYProgress, [0, 1], [0, 220]);

  const x = useSpring(xRaw, spring);
  const y = useSpring(yRaw, spring);
  const scale = useSpring(scaleRaw, spring);
  const rotate = useSpring(rotateRaw, spring);

  return (
    <motion.div
      style={{ x, y, scale }}
      className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2"
    >
      <Float x={6} y={16} dur={9}>
        <div className="relative">
          <div className="absolute left-1/2 top-1/2 size-[340px] sm:size-[520px] -translate-x-1/2 -translate-y-1/2">
            <motion.div
              style={{ rotate }}
              className="size-full rounded-full border border-[#4ecdc4]/15"
            />
          </div>
          <div
            className="size-[220px] sm:size-[380px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 28%, #4ecdc4 0%, #e8472a 42%, #1e1b4b 70%, #0a0820 100%)",
              boxShadow:
                "0 0 140px 30px rgba(232,71,42,0.45), 0 0 60px 10px rgba(78,205,196,0.35), inset -26px -26px 90px rgba(0,0,0,0.65)",
            }}
          />
        </div>
      </Float>
    </motion.div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ cta, scrollRef }: { cta: string; scrollRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const y = useTransform(scrollYProgress, [0, 0.25], [0, -120]);
  const fade = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  return (
    <section
      id="top"
      className="relative min-h-screen flex items-center justify-center px-5 pt-24 pb-16"
    >
      <motion.div
        style={{ y, opacity: fade }}
        className="relative z-10 max-w-4xl mx-auto text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md mb-7"
        >
          <Sparkles className="size-3.5 text-[#4ecdc4]" />
          Built for the RapidAgent Hackathon by Google
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-5xl sm:text-7xl font-bold tracking-tight leading-[0.98]"
        >
          Escape application
          <br />
          <span className="bg-gradient-to-r from-[#4ecdc4] via-[#fbd530] to-[#e8472a] bg-clip-text text-transparent">
            gravity
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed"
        >
          Your AI co-pilot for grad school. Find the right professors, build a shortlist, track
          every deadline, and draft outreach — all from one chat with an agent that shows its work.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic strength={0.4}>
            <Link
              href={cta}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#e8472a] px-6 py-3.5 text-base font-bold text-white shadow-[0_0_34px_rgba(232,71,42,0.6)] hover:shadow-[0_0_50px_rgba(78,205,196,0.8)] transition-shadow"
            >
              <Rocket className="size-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              Try it free
            </Link>
          </Magnetic>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-semibold text-white/90 backdrop-blur-md hover:bg-white/10 transition-colors"
          >
            See it in action
          </a>
        </motion.div>
      </motion.div>
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-white/30 text-xs flex flex-col items-center gap-1.5">
        <span>scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="block h-3 w-[2px] bg-white/40"
        />
      </div>
    </section>
  );
}

// ── Demo ────────────────────────────────────────────────────────────────────
function Demo({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  return (
    <section id="demo" className="relative px-5 py-28">
      <div className="relative max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#4ecdc4]">
              Watch it work
            </span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
              The agent that shows its thinking
            </h2>
            <p className="mt-4 text-white/55 max-w-xl mx-auto">
              Ask in plain English. Watch it plan, search, and act — every step visible, with an
              approval gate before anything changes.
            </p>
          </div>
        </Reveal>
        <ScaleIn scrollRef={scrollRef}>
          <Float x={4} y={8} dur={8}>
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl shadow-[0_40px_120px_-20px_rgba(232,71,42,0.4)]">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-white/40 font-mono">grad-paddy · chat</span>
              </div>
              <ChatMockup />
            </div>
          </Float>
        </ScaleIn>
      </div>
    </section>
  );
}

function ChatMockup() {
  const [step, setStep] = useState(0);
  const started = useRef(false);
  function start() {
    if (started.current) return;
    started.current = true;
    [400, 1100, 1900, 2700, 3600].forEach((t, i) => setTimeout(() => setStep(i + 1), t));
  }
  return (
    <motion.div
      onViewportEnter={start}
      viewport={{ once: true, amount: 0.4 }}
      className="rounded-xl p-5 space-y-4 min-h-[420px] border border-white/5"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {step >= 1 && (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-end"
        >
          <div className="max-w-[78%] rounded-xl bg-gradient-to-r from-cyan-500/80 to-[#e8472a]/80 text-white px-4 py-2.5 text-sm font-medium border border-white/10">
            Find NLP professors at MIT and Stanford taking PhD students
          </div>
        </motion.div>
      )}
      {step >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 text-white">
            <Brain className="size-4 text-[#4ecdc4]" strokeWidth={2.5} />
            <span className="font-bold text-sm">Agent · Thinking</span>
            {step >= 4 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#4ecdc4]/20 text-[#4ecdc4] text-[10px] font-bold px-2 py-0.5 border border-[#4ecdc4]/30">
                <Check className="size-3" /> Done
              </span>
            )}
          </div>
          <div className="p-3 space-y-1.5">
            {[
              "Planning the search",
              "Searching the web",
              "Reading faculty profiles",
              "Checking open positions",
            ].map((t, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, x: -10 }}
                animate={step >= 3 ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.18 }}
                className="flex items-center gap-2 text-xs font-medium text-white/80"
              >
                <span className="size-3.5 grid place-items-center rounded bg-[#4ecdc4]/20 border border-[#4ecdc4]/40 shrink-0">
                  <Check className="size-2.5 text-[#4ecdc4]" strokeWidth={3} />
                </span>
                {t}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      {step >= 5 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <span className="size-8 shrink-0 grid place-items-center rounded-lg bg-gradient-to-br from-[#4ecdc4] to-[#e8472a]">
            <Sparkles className="size-4 text-white" strokeWidth={2.5} />
          </span>
          <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/85 leading-relaxed">
            Found <b className="text-white">6 strong matches</b>. Top picks:{" "}
            <b className="text-[#4ecdc4]">Prof. Jurafsky (Stanford)</b> — fit 94%, actively
            recruiting; <b className="text-[#4ecdc4]">Prof. Andreas (MIT)</b> — fit 91%. Want me to
            draft outreach or add them to your shortlist?
            <span className="typewriter-caret" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Flip card ─────────────────────────────────────────────────────────────────
function FlipCard({ card }: { card: (typeof FLIP_CARDS)[0] }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className="h-60 cursor-pointer select-none"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front — Problem */}
        <div
          className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 flex flex-col gap-4"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div
            className="size-11 grid place-items-center rounded-xl border border-white/10"
            style={{
              background: `radial-gradient(circle at 38% 28%, ${card.glow}35, transparent 68%)`,
              boxShadow: `0 0 18px -4px ${card.glow}60`,
            }}
          >
            <card.icon className="size-5 text-white/60" strokeWidth={2} />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{card.problemTitle}</h3>
              <p className="mt-1.5 text-sm text-white/40 leading-relaxed">{card.problemDesc}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/18">
              Hover to solve →
            </span>
          </div>
        </div>

        {/* Back — Solution */}
        <div
          className="absolute inset-0 rounded-2xl border p-6 flex flex-col gap-4"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderColor: `${card.glow}35`,
            background: `radial-gradient(circle at 18% 18%, ${card.glow}22, transparent 58%), rgba(255,255,255,0.03)`,
            boxShadow: `0 0 60px -12px ${card.glow}`,
          }}
        >
          <div
            className="size-11 grid place-items-center rounded-xl border"
            style={{
              borderColor: `${card.glow}45`,
              background: `${card.glow}18`,
            }}
          >
            <Check className="size-5" style={{ color: card.glow }} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold" style={{ color: card.glow }}>
              {card.solutionTitle}
            </h3>
            <p className="mt-1.5 text-sm text-white/75 leading-relaxed">{card.solutionDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Problems ──────────────────────────────────────────────────────────────────
function Problems() {
  return (
    <section id="problems" className="relative px-5 py-28">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#fbd530]">
              The problem
            </span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
              Six things that slow every applicant down
            </h2>
            <p className="mt-4 text-white/40 text-sm">Hover a card to see how we handle it.</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FLIP_CARDS.map((card, i) => (
            <Reveal key={i} delay={i * 0.07} dir="up">
              <FlipCard card={card} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" className="relative px-5 py-28">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#e8472a]">
              How it works
            </span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
              From “where do I start” to submitted
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} dir={i % 2 === 0 ? "right" : "left"}>
              <Float x={5} y={8} dur={6 + i}>
                <Magnetic strength={0.18}>
                  <div
                    className="group rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 h-full flex gap-5 transition-shadow hover:shadow-[0_0_40px_-8px_var(--g)]"
                    style={{ ["--g" as string]: s.glow }}
                  >
                    <div
                      className="size-14 shrink-0 grid place-items-center rounded-xl border border-white/15"
                      style={{
                        background: `radial-gradient(circle at 40% 30%, ${s.glow}55, transparent 70%)`,
                        boxShadow: `0 0 24px -4px ${s.glow}`,
                      }}
                    >
                      <s.Icon className="size-6" strokeWidth={2.5} style={{ color: s.glow }} />
                    </div>
                    <div>
                      <div className="font-mono text-xs text-white/40 mb-1">{s.n}</div>
                      <h3 className="text-xl font-bold mb-1.5">{s.title}</h3>
                      <p className="text-sm text-white/55 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </Magnetic>
              </Float>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Team (constellation) ──────────────────────────────────────────────────────
function Team() {
  const [active, setActive] = useState<Member | null>(null);
  return (
    <section id="team" className="relative px-5 py-28">
      <Reveal>
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#4ecdc4]">
            The crew
          </span>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
            Three engineers, one constellation
          </h2>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold backdrop-blur-md hover:bg-white/10 transition-colors"
          >
            <Icon icon="mdi:github" width={18} /> View the project on GitHub
          </a>
        </div>
      </Reveal>

      <div className="relative max-w-4xl mx-auto h-[440px] hidden sm:block">
        {/* constellation links */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <line
            x1="18%"
            y1="12%"
            x2="58%"
            y2="46%"
            stroke="rgba(78,205,196,0.25)"
            strokeWidth="1"
          />
          <line
            x1="58%"
            y1="46%"
            x2="72%"
            y2="16%"
            stroke="rgba(168,85,247,0.25)"
            strokeWidth="1"
          />
          <line
            x1="18%"
            y1="12%"
            x2="72%"
            y2="16%"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        </svg>
        {TEAM.map((m, i) => (
          <div key={m.name} className="absolute" style={{ top: m.pos.top, left: m.pos.left }}>
            <Float x={18} y={16} dur={7 + i}>
              <Magnetic strength={0.6}>
                <Avatar member={m} onClick={() => setActive(m)} />
              </Magnetic>
            </Float>
          </div>
        ))}
      </div>

      {/* mobile fallback: simple stack */}
      <div className="sm:hidden flex flex-col gap-4 max-w-sm mx-auto">
        {TEAM.map((m) => (
          <button
            key={m.name}
            onClick={() => setActive(m)}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
          >
            <span
              className="size-12 grid place-items-center rounded-full font-mono font-bold"
              style={{
                background: `radial-gradient(circle at 40% 30%, ${m.glow}, #1e1b4b)`,
                boxShadow: `0 0 20px -2px ${m.glow}`,
              }}
            >
              {m.initials}
            </span>
            <span>
              <span className="block font-bold">{m.name}</span>
              <span className="block text-xs text-white/50">{m.role}</span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {active && <TeamModal member={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </section>
  );
}

function Avatar({ member, onClick }: { member: Member; onClick: () => void }) {
  return (
    <button data-cursor onClick={onClick} className="group flex flex-col items-center gap-2">
      <span
        className="size-20 grid place-items-center rounded-full font-mono font-bold text-2xl text-white transition-transform group-hover:scale-110"
        style={{
          background: `radial-gradient(circle at 38% 30%, ${member.glow}, #1e1b4b 75%)`,
          boxShadow: `0 0 30px -4px ${member.glow}, inset -8px -8px 24px rgba(0,0,0,0.5)`,
        }}
      >
        {member.initials}
      </span>
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold backdrop-blur-md whitespace-nowrap">
        {member.name}
      </span>
    </button>
  );
}

function TeamModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const lines = [member.role, member.bio];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[120] grid place-items-center p-5"
      style={{ background: "rgba(5,6,15,0.7)", backdropFilter: "blur(6px)" }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-2xl p-8 text-center"
        style={{ boxShadow: `0 0 80px -10px ${member.glow}` }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 size-8 grid place-items-center rounded-lg border border-white/10 text-white/60 hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <span
          className="mx-auto size-24 grid place-items-center rounded-full font-mono font-bold text-3xl"
          style={{
            background: `radial-gradient(circle at 38% 30%, ${member.glow}, #1e1b4b 75%)`,
            boxShadow: `0 0 40px -4px ${member.glow}`,
          }}
        >
          {member.initials}
        </span>
        <h3 className="mt-5 text-2xl font-bold">{member.name}</h3>
        {lines.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.12 }}
            className={
              i === 0
                ? "mt-1 text-sm font-semibold text-[#4ecdc4]"
                : "mt-3 text-sm text-white/60 leading-relaxed"
            }
          >
            {l}
          </motion.p>
        ))}
        <motion.a
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          href={member.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-[#05060f] px-5 py-2.5 text-sm font-bold"
        >
          <Icon icon="mdi:linkedin" width={18} /> Connect on LinkedIn
        </motion.a>
      </motion.div>
    </motion.div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer({ cta }: { cta: string }) {
  return (
    <footer className="relative px-5 py-16 border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-10 text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready for liftoff?</h2>
            <p className="mt-3 text-white/55 max-w-md mx-auto">
              Start your grad-school search with an agent that does the heavy lifting.
            </p>
            <Magnetic strength={0.4} className="inline-block mt-7">
              <Link
                href={cta}
                className="inline-flex items-center gap-2 rounded-xl bg-[#e8472a] px-7 py-4 text-base font-bold text-white shadow-[0_0_34px_rgba(232,71,42,0.6)]"
              >
                <MessageSquare className="size-5" /> Start chatting
              </Link>
            </Magnetic>
          </div>
        </Reveal>
        <div className="flex flex-col md:flex-row items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5 mr-auto">
            <span
              className="size-9 grid place-items-center border-[3px] border-white bg-[#ff4500]"
              style={{ boxShadow: "0 0 18px rgba(255,69,0,0.7)" }}
            >
              <Icon icon="solar:diploma-bold" width={18} className="text-white" />
            </span>
            <span className="font-extrabold text-lg font-syne tracking-tight">GRAD PADDY</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-white/50">
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white transition-colors">
              Terms
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="grid size-9 place-items-center rounded-lg border border-white/10 hover:border-white/30 transition-colors"
            >
              <Icon icon="mdi:github" width={18} />
            </a>
          </div>
        </div>
        <p className="mt-8 text-xs text-white/30 font-mono">
          © 2026 Grad Paddy · Built for the RapidAgent Hackathon by Google.
        </p>
      </div>
    </footer>
  );
}

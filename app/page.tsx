"use client";

import {
  MotionConfig,
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";

import podPadel from "./images/pod-padel.webp";
import podPickleball from "./images/pod-pickleball.webp";
import podTennis from "./images/pod-tennis.webp";

const ease = [0.22, 1, 0.36, 1] as const;

// first-touch attribution: remember how the visitor originally found us,
// so the waitlist submission can carry it
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
const UTM_STORAGE_KEY = "aurevo-utm";

function captureUtm() {
  try {
    if (window.localStorage.getItem(UTM_STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utm[key] = value.slice(0, 200);
    }
    if (document.referrer) utm.referrer = document.referrer.slice(0, 500);
    if (Object.keys(utm).length === 0) return;
    utm.landed_at = new Date().toISOString();
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // storage unavailable (private mode etc.); attribution is best-effort
  }
}

// the pod on every racket it supports, one photo per sport
const podShots = [
  {
    src: podTennis,
    sport: "Tennis",
    alt: "Aurevo pod clipped to the handle of a tennis racket lying on a clay court",
  },
  {
    src: podPadel,
    sport: "Padel",
    alt: "Aurevo pod clipped to the handle of a padel racket held up on a padel court",
  },
  {
    src: podPickleball,
    sport: "Pickleball",
    alt: "Aurevo pod clipped to the handle of a pickleball paddle held above the net",
  },
];

const metrics = [
  { label: "Contact", value: "94", unit: "/100", delta: "+8%" },
  { label: "Power", value: "112", unit: "km/h", delta: "+6%" },
  { label: "Control", value: "87", unit: "%", delta: "+12%" },
];

// how long each phone screen stays up; also drives the tab fill-up indicator
const TOUR_INTERVAL = 3800;

// live HTML mockups shown inside the phone; width = each file's rendered content width
const appViews = [
  {
    file: "/app-ui/progress.html",
    width: 336,
    label: "Progress",
    title: "Aurevo progress screen",
  },
  {
    file: "/app-ui/club.html",
    width: 410,
    label: "Club",
    title: "Aurevo club screen",
  },
];

// pre-baked impact cluster around the sweet spot, so the heatmap reads instantly
// (14 of 19 inside the sweet zone -> 74% hits, matching the app UI)
const seedImpacts = [
  { x: 48, y: 44 }, { x: 52, y: 46 }, { x: 50, y: 48 }, { x: 49, y: 45 },
  { x: 51, y: 49 }, { x: 47, y: 47 }, { x: 53, y: 44 }, { x: 50, y: 43 },
  { x: 52, y: 50 }, { x: 46, y: 45 }, { x: 54, y: 47 }, { x: 49, y: 50 },
  { x: 51, y: 45 }, { x: 48, y: 49 },
  { x: 35, y: 62 }, { x: 64, y: 35 }, { x: 60, y: 64 }, { x: 38, y: 32 },
  { x: 66, y: 58 },
];

const SWEET_CENTER = { x: 50, y: 47 };
const SWEET_RADIUS = 16;

// thermal colormap stops: [t, r, g, b, alpha]
const heatStops: Array<[number, number, number, number, number]> = [
  [0.0, 40, 90, 200, 0],
  [0.18, 45, 100, 210, 95],
  [0.35, 60, 175, 145, 150],
  [0.52, 140, 205, 70, 190],
  [0.68, 235, 220, 70, 220],
  [0.84, 245, 150, 45, 240],
  [1.0, 232, 58, 30, 255],
];

const heatLut = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let j = 1;
    while (j < heatStops.length - 1 && heatStops[j][0] < t) j++;
    const a = heatStops[j - 1];
    const b = heatStops[j];
    const f = (t - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 4; c++) {
      lut[i * 4 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
    }
  }
  return lut;
})();

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={down ? "icon icon-down" : "icon"}
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// drifts the section's background art away from the cursor (inverse parallax),
// writing CSS vars directly so mouse moves never re-render the page
function useMouseDrift() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      x += (targetX - x) * 0.07;
      y += (targetY - y) * 0.07;
      el.style.setProperty("--drift-x", `${x.toFixed(2)}px`);
      el.style.setProperty("--drift-y", `${y.toFixed(2)}px`);
      if (Math.abs(targetX - x) < 0.05 && Math.abs(targetY - y) < 0.05) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      targetX = -((event.clientX - rect.left) / rect.width - 0.5) * 80;
      targetY = -((event.clientY - rect.top) / rect.height - 0.5) * 56;
      kick();
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}

function SweetSpot() {
  const [points, setPoints] = useState(seedImpacts);
  // the drag cue sits on the strings until the first paint, then fades out
  const [interacted, setInteracted] = useState(false);
  // slow idle drift phase; paused while the user is interacting
  const [phase, setPhase] = useState(0);
  const lastRef = useRef({ x: 51, y: 45 });
  const touchedAtRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { margin: "-10% 0px" });

  function addPoint(event: React.PointerEvent<HTMLDivElement>) {
    setInteracted(true);
    touchedAtRef.current = performance.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(90, Math.max(10, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(90, Math.max(10, ((event.clientY - rect.top) / rect.height) * 100));
    if (Math.hypot(x - lastRef.current.x, y - lastRef.current.y) < 3) return;
    lastRef.current = { x, y };
    setPoints((prev) => [...prev.slice(-79), { x, y }]);
  }

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      // a slow drift doesn't need 60fps; ~12fps keeps the redraw cheap
      if (t - last < 80) return;
      last = t;
      if (performance.now() - touchedAtRef.current > 1200) setPhase(t / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      // density pass: stack translucent blobs, then map density through the thermal LUT
      const radius = w * 0.3;
      let i = 0;
      for (const point of points) {
        i += 1;
        const px = ((point.x + Math.sin(phase * 0.55 + i * 1.9) * 1.4) / 100) * w;
        const py = ((point.y + Math.cos(phase * 0.42 + i * 1.3) * 1.2) / 100) * h;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, "rgba(0,0,0,0.26)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      }
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const idx = d[i + 3] * 4;
        d[i] = heatLut[idx];
        d[i + 1] = heatLut[idx + 1];
        d[i + 2] = heatLut[idx + 2];
        d[i + 3] = heatLut[idx + 3];
      }
      ctx.putImageData(img, 0, 0);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, phase]);

  const hits = points.filter(
    (p) => Math.hypot(p.x - SWEET_CENTER.x, p.y - SWEET_CENTER.y) <= SWEET_RADIUS,
  ).length;
  const pct = Math.round((hits / points.length) * 100);

  return (
    <div className="sweet-card" ref={cardRef}>
      <div className="sweet-head">
        <span>SWEET SPOT</span>
        <em>· where you strike</em>
      </div>
      <div className="sweet-body">
        <div
          className="racket-oval"
          onPointerMove={addPoint}
          onPointerDown={addPoint}
          role="img"
          aria-label="Interactive heatmap of where the ball strikes the racket"
        >
          <div className="racket-strings" />
          <canvas ref={canvasRef} className="heat-canvas" />
          <span
            className={interacted ? "heat-cue is-hidden" : "heat-cue"}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="hint-drag">
              <path d="M2.5 12h4.5M17 12h4.5M5.2 9.5 2.5 12l2.7 2.5M18.8 9.5l2.7 2.5-2.7 2.5" />
              <circle cx="12" cy="12" r="2.4" />
            </svg>
            <span className="cue-text">Drag across the strings</span>
            <span className="cue-text-short">Drag</span>
          </span>
        </div>
        <div className="sweet-stats">
          <span className="sweet-label">Sweet-spot hits</span>
          <div className="sweet-big">
            <strong>{pct}</strong>
            <small>%</small>
            <i>↑ from 68</i>
          </div>
          <div className="sweet-divider" />
          <span className="sweet-label">Clean by wing</span>
          <div className="wing-row">
            <span>FH <b className="fh">81%</b></span>
            <span>BH <b className="bh">67%</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PodVisual() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "-20% 0px" });

  useEffect(() => {
    if (!inView || paused) return;
    const id = setInterval(
      () => setActive((current) => (current + 1) % podShots.length),
      3800,
    );
    return () => clearInterval(id);
  }, [inView, paused, active]);

  return (
    <div
      className="pod-stage"
      ref={stageRef}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {podShots.map((shot, index) => (
        <motion.div
          key={shot.sport}
          className="pod-shot"
          initial={false}
          animate={{
            opacity: index === active ? 1 : 0,
            scale: index === active ? 1 : 1.05,
          }}
          transition={{ duration: 0.9, ease }}
        >
          <Image
            src={shot.src}
            alt={shot.alt}
            fill
            sizes="(max-width: 980px) 100vw, 62vw"
            placeholder="blur"
          />
        </motion.div>
      ))}
      <span className="pod-tag">ONE POD / EVERY RACKET</span>
      <div className="pod-switch" role="tablist" aria-label="The pod on each racket">
        {podShots.map((shot, index) => (
          <button
            key={shot.sport}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={index === active ? "pod-dot is-active" : "pod-dot"}
            onClick={() => setActive(index)}
          >
            {shot.sport}
          </button>
        ))}
      </div>
    </div>
  );
}

function TabIcon({ view }: { view: string }) {
  return view === "Progress" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="tab-icon">
      <path d="M4 19h16M5 15l4-5 3.4 3L19 6" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="tab-icon">
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5.5a0 0 0 0 0 0 0c0 2.4 1 4 2.9 4M16 5h2.5c0 2.4-1 4-2.9 4M12 11v4m-3 5h6m-3-5v5" />
    </svg>
  );
}

function AppPhone() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // per-view visit counters key the iframes, so activating a view remounts it
  // and replays the mockup's built-in intro (bars fill, numbers count up)
  const [visits, setVisits] = useState(() => appViews.map(() => 0));
  const [screenWidth, setScreenWidth] = useState(324);
  const stageRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const inView = useInView(stageRef, { margin: "-25% 0px" });

  function show(index: number) {
    setActive(index);
    setVisits((prev) => prev.map((v, i) => (i === index ? v + 1 : v)));
  }

  // replay the first view's intro when the phone first scrolls into view
  useEffect(() => {
    if (inView && !startedRef.current) {
      startedRef.current = true;
      show(0);
    }
  }, [inView]);

  useEffect(() => {
    if (!inView || paused) return;
    const id = setInterval(
      () => show((active + 1) % appViews.length),
      TOUR_INTERVAL,
    );
    return () => clearInterval(id);
  }, [inView, paused, active]);

  const autoplaying = inView && !paused;

  // the mockups are fixed-width pages; scale each iframe to the phone screen
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const measure = () => setScreenWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="tour-device" ref={stageRef}>
      <div className="phone-frame">
        <div className="phone-hardware" aria-hidden="true">
          <span />
        </div>
        <div className="phone-screen" ref={screenRef}>
          {appViews.map((view, index) => (
            <motion.div
              key={view.file}
              className="tour-screen"
              initial={false}
              animate={{ opacity: index === active ? 1 : 0 }}
              transition={{ duration: 0.55, ease }}
            >
              <iframe
                key={`${view.file}#${visits[index]}`}
                src={view.file}
                title={view.title}
                className="tour-iframe"
                style={{
                  width: view.width,
                  height: (view.width * 852) / 393,
                  transform: `scale(${screenWidth / view.width})`,
                }}
              />
            </motion.div>
          ))}
          <div className="phone-tabbar" role="tablist" aria-label="App views">
            {appViews.map((view, index) => (
              <button
                key={view.label}
                type="button"
                role="tab"
                aria-selected={index === active}
                className={index === active ? "phone-tab is-active" : "phone-tab"}
                onClick={() => {
                  show(index);
                  setPaused(true);
                }}
              >
                <span className="tab-content">
                  <TabIcon view={view.label} />
                  <span>{view.label}</span>
                </span>
                {index === active && (
                  <span
                    key={`${visits[index]}-${autoplaying}`}
                    aria-hidden="true"
                    className={
                      autoplaying
                        ? "tab-content tab-fill is-filling"
                        : "tab-content tab-fill"
                    }
                    style={{ animationDuration: `${TOUR_INTERVAL}ms` }}
                  >
                    <TabIcon view={view.label} />
                    <span>{view.label}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      // the breathing glow only starts once the hero has scrolled away
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={scrolled ? "nav is-scrolled" : "nav"}>
      <a className="wordmark nav-island" href="#top" aria-label="Aurevo home">
        <span>AUREVO</span>
      </a>
      <div className="nav-island nav-island-cta">
        <a
          className={pastHero ? "nav-cta is-breathing" : "nav-cta"}
          href="#waitlist"
        >
          Join waitlist
          <Arrow />
        </a>
      </div>
    </nav>
  );
}

function Waitlist() {
  const [joined, setJoined] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const note = String(form.get("note") || "");
    if (!email) return;

    let utm: Record<string, string> = {};
    try {
      utm = JSON.parse(window.localStorage.getItem(UTM_STORAGE_KEY) || "{}");
    } catch {}

    const endpoint = process.env.NEXT_PUBLIC_WAITLIST_WEBHOOK_URL;
    if (endpoint) {
      // Apps Script can't answer a CORS preflight, so send a "simple" request:
      // text/plain + no-cors delivers the POST without one (response is opaque)
      fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          email,
          note,
          ...utm,
          page: window.location.pathname,
          submitted_at: new Date().toISOString(),
        }),
      }).catch(() => {});
    }

    window.localStorage.setItem("aurevo-waitlist-email", email);
    if (note) {
      window.localStorage.setItem("aurevo-waitlist-note", note);
    }
    setJoined(true);
  }

  return (
    <form className="waitlist-form" onSubmit={submit}>
      {joined ? (
        <motion.p
          className="success-message"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          You&apos;re early. We&apos;ll see you on court.
        </motion.p>
      ) : (
        <>
          <label className="sr-only" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            className="waitlist-email"
          />
          <label className="sr-only" htmlFor="note">
            How hyped are you? Or what would you love it to measure?
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            placeholder="How hyped are you? Or what would you love it to measure? Best comments win a free one"
          />
          <button type="submit" className="waitlist-submit">
            Join the waitlist
            <Arrow />
          </button>
        </>
      )}
    </form>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const heroScale = useTransform(smoothProgress, [0, 1], [1, 1.12]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.85], [1, 0.35]);
  const heroY = useTransform(smoothProgress, [0, 1], [0, 110]);
  const driftRef = useMouseDrift();

  useEffect(() => {
    captureUtm();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <main>
        <Nav />

        <section className="hero" id="top" ref={heroRef}>
          <motion.video
            data-testid="hero-video"
            className="hero-video"
            style={{ scale: heroScale }}
            src="/hero.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="hero-wash" />
          <motion.div
            className="hero-content"
            style={{ opacity: heroOpacity, y: heroY }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease }}
            >
              See what
              <br />
              <em>your racket knows.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease }}
            >
              Every strike sends information through the handle. Aurevo
              captures it, helping you understand your swings, impacts and
              progress over time.
            </motion.p>
            <motion.a
              className="primary-cta"
              href="#waitlist"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.58, ease }}
            >
              Join the waitlist
              <Arrow />
            </motion.a>
          </motion.div>
          <div className="hero-footer">
            <a href="#problem">
              Discover Aurevo
              <Arrow down />
            </a>
          </div>
        </section>

        <section className="manifesto" id="problem">
          <Reveal className="manifesto-inner">
            <span className="section-number">01 / THE PROBLEM</span>
            <h2>
              Per strike performance is unmeasured, we are changing that.
              <br />
              <span>Measure the shot. Not the arm.</span>
            </h2>
            <p>
              You can feel a clean hit the moment it lands, yet nothing
              records it. That detail has vanished after every rally, with
              existing wearable offerings treating a two-hour match like a
              jog. Until now.
            </p>
          </Reveal>
          <div className="signal-line" aria-hidden="true">
            <i />
            <b />
            <i />
            <b />
            <i />
          </div>
        </section>

        <section className="dual-mode section-pad" id="technology">
          <div className="dual-copy">
            <Reveal>
              <span className="section-number light">02 / INTRODUCING AUREVO</span>
              <h2>
                A lightweight smart bracelet
                <br />
                <em>that attaches to your racket.</em>
              </h2>
              <p>
                Aurevo brings 24/7 body insights, then asks why they should
                stop there. When the same pod clips to the handle, Aurevo
                measures the shot, not the arm.
              </p>
            </Reveal>
          </div>
          <Reveal className="dual-visual" delay={0.1}>
            <PodVisual />
          </Reveal>
          {/* on mobile this lands below the pod images, splitting the copy */}
          <div className="dual-after">
            <Reveal>
              <p>
                Racket sensors reveal cutting-edge data, yet go unused because
                they&apos;re another thing to remember and only work for one
                sport. Aurevo is already with you, and in seconds the pod moves
                from wrist to racket.
              </p>
            </Reveal>
            <Reveal className="sport-list" delay={0.16}>
              <span>TENNIS</span>
              <i />
              <span>PADEL</span>
              <i />
              <span>PICKLEBALL</span>
              <i />
              <span>MORE TO COME</span>
            </Reveal>
          </div>
        </section>

        <section className="measurement section-pad" id="data">
          <div className="measurement-copy">
            <Reveal>
              <span className="section-number">03 / DIRECT FROM THE HANDLE</span>
              <h2>See the shot behind the score.</h2>
              <p>
                Capturing the direct impact signal a wrist can only extrapolate
                from, Aurevo unlocks sport-specific metrics, from contact
                quality and power versus control to previously unreachable
                views like a heat map of where the ball struck the racket.
              </p>
            </Reveal>
            <Reveal className="metric-strip" delay={0.12}>
              {metrics.map((metric) => (
                <div className="metric" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.unit}</small>
                  <i>{metric.delta}</i>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal className="measurement-visual" delay={0.08}>
            <SweetSpot />
          </Reveal>
        </section>

        <section className="app-overview section-pad" id="app" ref={driftRef}>
          {/* aerial court linework, shot placements marked in the service box */}
          <div className="court-sketch" aria-hidden="true">
            <svg viewBox="0 0 780 360" fill="none">
              <rect
                x="1" y="1" width="778" height="358"
                stroke="rgba(255,255,255,0.07)" vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1 45h778M1 315h778M180 45v270M600 45v270M180 180h420"
                stroke="rgba(255,255,255,0.07)" vectorEffect="non-scaling-stroke"
              />
              <path
                d="M390 1v358"
                stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1 180h13M766 180h13"
                stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke"
              />
              <circle cx="470" cy="120" r="6" fill="rgba(202,255,56,0.2)" />
              <circle cx="506" cy="94" r="5" fill="rgba(202,255,56,0.16)" />
              <circle cx="536" cy="141" r="7" fill="rgba(202,255,56,0.3)" />
              <circle cx="489" cy="152" r="4.5" fill="rgba(202,255,56,0.14)" />
              <circle cx="648" cy="228" r="5" fill="rgba(202,255,56,0.12)" />
            </svg>
          </div>
          <div className="app-duo">
            <div className="app-copy">
              <Reveal>
                <span className="section-number light">04 / MEASURED COMPETITION</span>
                <h2>
                  Not just who won.
                  <br />
                  <span>But why.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p>
                  Every session compounds, fusing health and racket data,
                  showing what to work on next.
                </p>
                <p>
                  Add friends, build rivalries and let your player rating move
                  with measured performance rather than opinion. Face one of
                  them and you both get the breakdown.
                </p>
              </Reveal>
            </div>
            <Reveal className="app-visual" delay={0.1}>
              <AppPhone />
            </Reveal>
          </div>
          <Reveal className="pro-note" delay={0.1}>
            <span>COMING NEXT</span>
            <p>
              We&apos;ll put the same pod on the pros too, so you can finally
              see how your forehand stacks up against the players you grew up
              watching.
            </p>
          </Reveal>
        </section>

        <section className="final-cta" id="waitlist">
          <div className="court-lines" aria-hidden="true" />
          <Reveal className="final-inner">
            <span className="section-number light">THE QUANTIFIED ERA OF SPORT</span>
            <h2>Be first into the new era.</h2>
            <p>
              Sport is still waiting for its quantified layer. Aurevo is built
              to define it.
            </p>
            <p className="perks-line">
              Join the waitlist for perks, including founding pricing when we
              release.
            </p>
            <Waitlist />
          </Reveal>
          <footer>
            <a className="wordmark dark-wordmark" href="#top">
              <span>AUREVO</span>
            </a>
            <span>NO SPAM. JUST SIGNAL.</span>
          </footer>
        </section>
      </main>
    </MotionConfig>
  );
}

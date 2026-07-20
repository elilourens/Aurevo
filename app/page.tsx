"use client";

import {
  MotionConfig,
  MotionValue,
  motion,
  useInView,
  useMotionValueEvent,
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

// live HTML mockups shown inside the phone; width = each file's design width
const appScreens = [
  {
    file: "/app-ui/home.html",
    width: 642,
    label: "Today",
    blurb: "Health context beside your live game profile. Know when to push and when to recover.",
    title: "Aurevo home screen",
  },
  {
    file: "/app-ui/progress.html",
    width: 393,
    label: "Progress",
    blurb: "Every session teaches the next. See what's changing—not just what happened.",
    title: "Aurevo progress screen",
  },
  {
    file: "/app-ui/sport.html",
    width: 393,
    label: "Your sport",
    blurb: "Go deep on one sport—win rate, controlled power and a sweet-spot map of where you strike.",
    title: "Aurevo tennis screen",
  },
  {
    file: "/app-ui/sessions.html",
    width: 410,
    label: "Sessions",
    blurb: "A season you can read. Every match searchable by sport, score and intensity.",
    title: "Aurevo sessions screen",
  },
  {
    file: "/app-ui/club.html",
    width: 410,
    label: "Club",
    blurb: "Win the match, know why. Rivalries and a rating that moves on measured performance.",
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

function Mark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="brand-mark">
      <path d="M5 24 13.4 6h5.2L27 24h-5.8l-1.5-3.7h-7.5L10.8 24H5Z" />
      <path className="brand-mark-cut" d="m14 16.2 2-5.2 2 5.2h-4Z" />
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

function SweetSpot() {
  const [points, setPoints] = useState(seedImpacts);
  const lastRef = useRef({ x: 51, y: 45 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function addPoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(90, Math.max(10, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(90, Math.max(10, ((event.clientY - rect.top) / rect.height) * 100));
    if (Math.hypot(x - lastRef.current.x, y - lastRef.current.y) < 3) return;
    lastRef.current = { x, y };
    setPoints((prev) => [...prev.slice(-79), { x, y }]);
  }

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
      for (const point of points) {
        const px = (point.x / 100) * w;
        const py = (point.y / 100) * h;
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
  }, [points]);

  const hits = points.filter(
    (p) => Math.hypot(p.x - SWEET_CENTER.x, p.y - SWEET_CENTER.y) <= SWEET_RADIUS,
  ).length;
  const pct = Math.round((hits / points.length) * 100);

  return (
    <div className="sweet-card">
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
      <span className="sweet-hint">Move across the strings</span>
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

function TourTab({
  screen,
  index,
  active,
  progress,
  onSelect,
}: {
  screen: (typeof appScreens)[number];
  index: number;
  active: boolean;
  progress: MotionValue<number>;
  onSelect: (index: number) => void;
}) {
  // this tab's slice of the pinned scroll; the underline fills across it
  const fill = useTransform(
    progress,
    [index / appScreens.length, (index + 1) / appScreens.length],
    [0, 1],
  );

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? "app-tab is-active" : "app-tab"}
      onClick={() => onSelect(index)}
    >
      <span>0{index + 1}</span>
      <div>
        <strong>{screen.label}</strong>
        <p>{screen.blurb}</p>
      </div>
      <i className="tab-progress" aria-hidden="true">
        <motion.b style={{ scaleX: fill }} />
      </i>
    </button>
  );
}

function AppTour() {
  const [active, setActive] = useState(0);
  const [screenWidth, setScreenWidth] = useState(324);
  const trackRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // each screen owns an equal slice of the scroll track
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const index = Math.min(
      appScreens.length - 1,
      Math.max(0, Math.floor(value * appScreens.length)),
    );
    setActive(index);
  });

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

  function jumpTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const scrollable = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((index + 0.5) / appScreens.length) * scrollable,
      behavior: "smooth",
    });
  }

  return (
    <div
      className="tour-track"
      ref={trackRef}
      style={{ height: `${100 + appScreens.length * 80}svh` }}
    >
      <div className="tour-pin">
        <div className="app-tour">
          <div className="app-tabs" role="tablist" aria-label="App screens">
            {appScreens.map((screen, index) => (
              <TourTab
                key={screen.label}
                screen={screen}
                index={index}
                active={index === active}
                progress={scrollYProgress}
                onSelect={jumpTo}
              />
            ))}
          </div>
          <div className="tour-device">
            <div className="device-glow" aria-hidden="true" />
            <div className="phone-frame">
              <div className="phone-hardware" aria-hidden="true">
                <span />
              </div>
              <div className="phone-screen" ref={screenRef}>
                {appScreens.map((screen, index) => (
                  <motion.div
                    key={screen.file}
                    className="tour-screen"
                    initial={false}
                    animate={{ opacity: index === active ? 1 : 0 }}
                    transition={{ duration: 0.55, ease }}
                  >
                    <iframe
                      src={screen.file}
                      title={screen.title}
                      className="tour-iframe"
                      style={{
                        width: screen.width,
                        height: (screen.width * 852) / 393,
                        transform: `scale(${screenWidth / screen.width})`,
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
            <p className="tour-caption">{appScreens[active].blurb}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Waitlist() {
  const [joined, setJoined] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const note = String(form.get("note") || "");
    if (email) {
      window.localStorage.setItem("aurevo-waitlist-email", email);
      if (note) {
        window.localStorage.setItem("aurevo-waitlist-note", note);
      }
      setJoined(true);
    }
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
          <label className="sr-only" htmlFor="note">
            What should Aurevo measure first?
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            placeholder="What should Aurevo measure first? (optional)"
          />
          <div className="waitlist-row">
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
            />
            <button type="submit">
              Join the waitlist
              <Arrow />
            </button>
          </div>
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

  return (
    <MotionConfig reducedMotion="user">
      <main>
        <nav className="nav">
          <a className="wordmark" href="#top" aria-label="Aurevo home">
            <Mark />
            <span>AUREVO</span>
          </a>
          <div className="nav-links">
            <a href="#technology">Technology</a>
            <a href="#data">Data</a>
            <a href="#app">App</a>
          </div>
          <a className="nav-cta" href="#waitlist">
            Join waitlist
            <Arrow />
          </a>
        </nav>

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
            <motion.span
              className="hero-kicker"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease }}
            >
              THE NEW MEASURE OF PLAY
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease }}
            >
              Every strike.
              <br />
              <em>Measured.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease }}
            >
              Meet Aurevo, a lightweight smart bracelet with a pod that
              attaches to the racket handle.
            </motion.p>
            <motion.a
              className="primary-cta"
              href="#waitlist"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.58, ease }}
            >
              Be first on court
              <Arrow />
            </motion.a>
          </motion.div>
          <div className="hero-footer">
            <span>BODY / RACKET / ONE POD</span>
            <a href="#problem">
              Discover Aurevo
              <Arrow down />
            </a>
          </div>
        </section>

        <section className="manifesto" id="problem">
          <Reveal className="manifesto-inner">
            <span className="section-number">01 / THE SIGNAL</span>
            <h2>
              Wearables count the steps.
              <br />
              <span>We measure the strike.</span>
            </h2>
            <p>
              Racket sports have always been measured by the outcome, not the
              performance. Each strike sends a vibration through the handle
              carrying details you can feel but never see—while a wrist
              wearable treats a two-hour match like a jog.
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
              <span className="section-number light">02 / ONE POD. TWO WORLDS.</span>
              <h2>Always with you.</h2>
              <p>
                Racket sensors already exist, but they go unused—another thing
                to remember, and only built for one sport. Aurevo is already on
                your wrist when the group chat turns into a game. In seconds,
                the pod moves from wrist to racket and measures the shot, not
                the arm.
              </p>
            </Reveal>
            <Reveal className="mode-list" delay={0.1}>
              <div>
                <span>01</span>
                <strong>NO WATCH</strong>
                <p>24/7 body insight without a screen strapped to your wrist.</p>
              </div>
              <div>
                <span>02</span>
                <strong>ONE APP</strong>
                <p>Tennis, padel and pickleball in one place—not an app per sport.</p>
              </div>
              <div>
                <span>03</span>
                <strong>THE HANDLE</strong>
                <p>Direct impact data from the racket itself, not estimates extrapolated from your arm.</p>
              </div>
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
          <Reveal className="dual-visual" delay={0.1}>
            <PodVisual />
          </Reveal>
        </section>

        <section className="measurement section-pad" id="data">
          <div className="measurement-copy">
            <Reveal>
              <span className="section-number">03 / DIRECT FROM THE HANDLE</span>
              <h2>See the shot behind the score.</h2>
              <p>
                Capturing the direct impact signal a wrist can only extrapolate
                from, Aurevo unlocks sport-specific metrics—contact quality,
                power versus control, and previously unreachable views like a
                map of where the ball struck the racket.
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

        <section className="app-overview section-pad" id="app">
          <div className="app-overview-head">
            <Reveal>
              <span className="section-number light">04 / THE COMPLETE PICTURE</span>
              <h2>Body and racket. One app.</h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p>
                Sleep, activity and recovery sit beside every match you play.
                Every session compounds, fusing health and racket data to show
                what to work on next.
              </p>
            </Reveal>
          </div>
          <AppTour />
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
            <span className="section-number">THE QUANTIFIED ERA OF SPORT</span>
            <h2>Be first into the game.</h2>
            <p>
              Sport is still waiting for its quantified layer. Aurevo is built
              to define it. The first cohort gets early access—and a say in
              what we measure next.
            </p>
            <Waitlist />
            <small>No spam. Just the signal.</small>
          </Reveal>
          <footer>
            <a className="wordmark dark-wordmark" href="#top">
              <Mark />
              <span>AUREVO</span>
            </a>
            <span>© 2026 AUREVO</span>
            <a href="mailto:hello@aurevo.co">HELLO@AUREVO.CO</a>
          </footer>
        </section>
      </main>
    </MotionConfig>
  );
}

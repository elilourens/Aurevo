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
import { FormEvent, useRef, useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const metrics = [
  { label: "Contact", value: "94", unit: "/100", delta: "+8%" },
  { label: "Power", value: "112", unit: "km/h", delta: "+6%" },
  { label: "Control", value: "87", unit: "%", delta: "+12%" },
];

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

function PhoneFrame({
  src,
  alt,
  className = "",
  preload = false,
}: {
  src: string;
  alt: string;
  className?: string;
  preload?: boolean;
}) {
  return (
    <motion.div
      className={`phone-frame ${className}`}
      initial={{ opacity: 0, y: 40, rotate: -1.5 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, ease }}
    >
      <div className="phone-hardware" aria-hidden="true">
        <span />
      </div>
      <div className="phone-screen">
        <Image
          src={src}
          alt={alt}
          fill
          preload={preload}
          sizes="(max-width: 700px) 86vw, 340px"
          className="phone-image"
        />
      </div>
    </motion.div>
  );
}

function ImpactMap() {
  const [point, setPoint] = useState({ x: 54, y: 46 });

  function updatePoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPoint({
      x: Math.min(86, Math.max(14, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(86, Math.max(14, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  }

  const quality = Math.round(
    98 - Math.hypot(point.x - 50, point.y - 48) * 0.85,
  );

  return (
    <div className="impact-card">
      <div className="impact-card-top">
        <div>
          <span className="eyebrow dark">LIVE IMPACT</span>
          <p>Forehand · 00:42</p>
        </div>
        <span className="live-dot">Recording</span>
      </div>
      <div
        className="racket-face"
        onPointerMove={updatePoint}
        onPointerDown={updatePoint}
        role="img"
        aria-label="Interactive racket impact map"
      >
        <div className="racket-grid" />
        <motion.div
          className="impact-ripple impact-ripple-large"
          animate={{ left: `${point.x}%`, top: `${point.y}%` }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        />
        <motion.div
          className="impact-ripple"
          animate={{ left: `${point.x}%`, top: `${point.y}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
        />
        <motion.div
          className="impact-point"
          animate={{ left: `${point.x}%`, top: `${point.y}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        />
        <span className="impact-hint">Move across the strings</span>
      </div>
      <div className="impact-result">
        <span>Contact quality</span>
        <strong>{quality}</strong>
        <small>/100</small>
        <div className="quality-track">
          <motion.i animate={{ width: `${quality}%` }} />
        </div>
      </div>
    </div>
  );
}

function PodVisual() {
  return (
    <div className="pod-stage" aria-label="Aurevo pod concept">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <motion.div
        className="pod-shadow"
        animate={{ scale: [1, 0.86, 1], opacity: [0.28, 0.16, 0.28] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pod"
        animate={{ y: [-8, 8, -8], rotate: [-3, 3, -3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="pod-sheen" />
        <Mark />
      </motion.div>
      <span className="pod-label pod-label-one">24/7 body</span>
      <span className="pod-label pod-label-two">Direct impact</span>
    </div>
  );
}

function Waitlist() {
  const [joined, setJoined] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    if (email) {
      window.localStorage.setItem("aurevo-waitlist-email", email);
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
            <a href="#progress">Progress</a>
            <a href="#club">Club</a>
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
              Feel it.
              <br />
              Now <em>see it.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease }}
            >
              The smart pod that turns every strike into a clearer way to
              improve.
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

        <section className="manifesto section-pad" id="problem">
          <Reveal className="manifesto-inner">
            <span className="section-number">01 / THE SIGNAL</span>
            <h2>
              Wearables count the steps.
              <br />
              <span>We measure the strike.</span>
            </h2>
            <p>
              Racket sports have always been measured by the outcome, not the
              performance. Each strike sends a vibration through the handle,
              carrying details you can feel but never see. Until now, that
              signal has vanished after every rally, with wearables treating a
              two-hour match like a jog, counting steps while missing how well
              you hit the ball. Meet Aurevo, the lightweight smart bracelet
              that attaches to the racket handle.
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
                Aurevo brings 24/7 body insights, then asks why they should
                stop there. When the same pod clips to the handle, Aurevo
                measures the shot, not the arm.
              </p>
            </Reveal>
            <Reveal className="mode-list" delay={0.1}>
              <div>
                <span>01</span>
                <strong>BODY</strong>
                <p>Recovery, movement and the context behind your game.</p>
              </div>
              <div>
                <span>02</span>
                <strong>RACKET</strong>
                <p>Direct impact data your wrist can only estimate.</p>
              </div>
            </Reveal>
          </div>
          <Reveal className="dual-visual" delay={0.1}>
            <PodVisual />
          </Reveal>
        </section>

        <section className="measurement section-pad">
          <div className="measurement-copy">
            <Reveal>
              <span className="section-number">03 / DIRECT FROM THE HANDLE</span>
              <h2>See the shot behind the score.</h2>
              <p>
                Capturing the direct impact signal a wrist can only extrapolate
                from, it unlocks sport-specific insight, from contact quality
                and power versus control to previously unreachable cinematics
                like a 3D map of where the ball struck the racket.
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
            <ImpactMap />
          </Reveal>
        </section>

        <section className="app-overview section-pad" id="app">
          <div className="app-overview-copy">
            <Reveal>
              <span className="section-number light">04 / THE COMPLETE PICTURE</span>
              <h2>Body and racket. Finally in one view.</h2>
              <p>
                Sleep, activity and recovery sit beside the details of your
                latest match. Aurevo connects how you arrived on court with how
                you performed once you got there.
              </p>
            </Reveal>
            <Reveal className="overview-points" delay={0.1}>
              <div>
                <span>01</span>
                <p><b>Ready to play</b>Know when to push and when to recover.</p>
              </div>
              <div>
                <span>02</span>
                <p><b>Made for action</b>Start a session in a single tap.</p>
              </div>
              <div>
                <span>03</span>
                <p><b>Built to compound</b>Every hit sharpens what comes next.</p>
              </div>
            </Reveal>
          </div>
          <div className="overview-device">
            <div className="device-glow" aria-hidden="true" />
            <PhoneFrame
              src="/ui-home.png"
              alt="Aurevo home screen showing player attributes, last tennis match, activity and sleep insights"
              className="phone-home"
              preload
            />
            <span className="device-note note-one">Health context</span>
            <span className="device-note note-two">Live game profile</span>
          </div>
        </section>

        <section className="progress section-pad" id="progress">
          <div className="progress-head">
            <Reveal>
              <span className="section-number light">05 / PROGRESS THAT COMPOUNDS</span>
              <h2>Every session teaches the next.</h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p>
                Every session compounds, fusing health and racket data, showing
                what to work on next.
              </p>
            </Reveal>
          </div>
          <div className="screen-feature">
            <div className="screen-copy">
              <Reveal>
                <span className="screen-kicker">Your trajectory</span>
                <h3>See what&apos;s changing—not just what happened.</h3>
                <p>
                  Follow session quality, shot volume and win rate across every
                  racket sport. Aurevo surfaces the weakest link and the
                  momentum worth carrying forward.
                </p>
              </Reveal>
              <Reveal className="feature-stat-row" delay={0.08}>
                <div><strong>+14%</strong><span>shots</span></div>
                <div><strong>+9%</strong><span>court time</span></div>
                <div><strong>+5%</strong><span>win rate</span></div>
              </Reveal>
            </div>
            <div className="screen-device progress-device">
              <PhoneFrame
                src="/ui-progress.png"
                alt="Aurevo progress screen showing session quality, sport trends and areas to improve"
                className="phone-progress"
              />
            </div>
          </div>
        </section>

        <section className="session-library section-pad" id="sessions">
          <div className="session-device">
            <PhoneFrame
              src="/ui-sessions.png"
              alt="Aurevo sessions screen showing tennis, padel and pickleball session summaries"
              className="phone-sessions"
            />
            <span className="session-orbit-label">Every session, searchable</span>
          </div>
          <div className="session-library-copy">
            <Reveal>
              <span className="section-number">06 / YOUR PLAYING HISTORY</span>
              <h2>A season you can read.</h2>
              <p>
                No more matches disappearing into memory. Filter every session
                by sport and revisit intensity, shot count, score and peak
                speed—then open the detail behind the result.
              </p>
            </Reveal>
            <Reveal className="session-tags" delay={0.1}>
              <span>Tennis</span><span>Padel</span><span>Pickleball</span>
            </Reveal>
          </div>
        </section>

        <section className="club section-pad" id="club">
          <div className="club-copy">
            <Reveal>
              <span className="section-number">07 / YOUR GAME, IN CONTEXT</span>
              <h2>Win the match. Know why.</h2>
              <p>
                Add friends, build rivalries and let your player rating move
                with real performance rather than self-reported scores. Face
                one of them and you both get the breakdown of not just who won,
                but why.
              </p>
            </Reveal>
            <Reveal className="pro-note" delay={0.12}>
              <span>COMING NEXT</span>
              <p>
                We&apos;ll put the same pod on the pros too, so you can finally
                see how your forehand stacks up against the players you grew up
                watching.
              </p>
            </Reveal>
          </div>
          <div className="club-device">
            <div className="club-card club-card-one">
              <span>RIVALRY</span><strong>8–5</strong><small>peak swing 112 vs 104</small>
            </div>
            <PhoneFrame
              src="/ui-club.png"
              alt="Aurevo Club screen showing player rating, upcoming matches, rivalry and friends"
              className="phone-club"
            />
            <div className="club-card club-card-two">
              <span>NEXT UP</span><strong>Saturday</strong><small>you &amp; Sam vs Adam &amp; Leo</small>
            </div>
          </div>
        </section>

        <section className="always section-pad">
          <div className="always-orbit" aria-hidden="true" />
          <Reveal className="always-inner">
            <span className="section-number light">08 / READY WHEN YOU ARE</span>
            <h2>
              No special kit.
              <br />
              No second thought.
            </h2>
            <p>
              Aesthetic, multi-sport and attached in seconds. Aurevo is already
              with you when the group chat turns into a game.
            </p>
            <div className="sport-list">
              <span>TENNIS</span>
              <i />
              <span>PADEL</span>
              <i />
              <span>PICKLEBALL</span>
              <i />
              <span>MORE TO COME</span>
            </div>
          </Reveal>
        </section>

        <section className="final-cta" id="waitlist">
          <div className="court-lines" aria-hidden="true" />
          <Reveal className="final-inner">
            <span className="section-number">THE QUANTIFIED ERA OF SPORT</span>
            <h2>Be first into the game.</h2>
            <p>
              Sport is still waiting for its quantified layer. Aurevo is built
              to define it. Join the waitlist and be first into the new era of
              measured competition.
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

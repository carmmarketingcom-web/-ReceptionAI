import { useEffect, useRef } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   PhoneShowcase — the hero "living phone" (Direction A of
   HOMEPAGE_PHONE_3D_CONCEPT.md).

   Motion is CSS-first and phase-locked to ONE 16s master clock (see the
   `.phone-stage` block in src/styles/app.css):
     idle → incoming call → answered + booked → call-ended chip →
     confirmation SMS → repeat-caller greeting → owner summary → loop reset.

   The effect below is the only JavaScript. It never touches React state, so
   the component renders once and never re-renders: it writes the custom
   properties --mx / --my / --p / --glow from a single rAF loop and toggles
   .in-view / .is-hidden. Without JS — and with prefers-reduced-motion —
   the static "after the call" frame is what renders.

   Every string is product copy passed in from the page's own constants
   (APP_DEMO / VOICE_STEPS / SMS_THREAD / OWNER_SUMMARY). Nothing is invented.
   The whole phone is decorative: aria-hidden, nothing focusable, no audio.
   ──────────────────────────────────────────────────────────────────────────── */

export type PhoneShowcaseApp = {
  org: string;
  caller: string;
  service: string;
  day: string;
  time: string;
  phone: string;
};

type Props = {
  app: PhoneShowcaseApp;
  /** VOICE_STEPS[3].text — the AI's booking line, verbatim. */
  bookedLine: string;
  /** SMS_THREAD[0].body — the booking-confirmation SMS, verbatim. */
  confirmationSms: string;
  /** OWNER_SUMMARY — lines [0..3] are shown on the summary card. */
  ownerSummary: string[];
};

const CALL_ENDED = "Call ended · 1m 42s · Appointment booked";
const REPEAT_TAG = "Repeat caller recognized";

/* ─── shared screen fragments ─── */
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-gray-400">
      <span>7:02 PM</span>
      <span className="flex items-end gap-[3px]">
        <span className="h-1 w-[3px] rounded-sm bg-gray-500" />
        <span className="h-1.5 w-[3px] rounded-sm bg-gray-500" />
        <span className="h-2 w-[3px] rounded-sm bg-gray-500" />
        <span className="ml-1 h-2 w-4 rounded-[3px] border border-gray-500 p-[1.5px]">
          <span className="block h-full w-2/3 rounded-[1px] bg-gray-500" />
        </span>
      </span>
    </div>
  );
}

function AppHeader({ org }: { org: string }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-3 py-2.5 shadow-lg shadow-indigo-950/40">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-extrabold text-white">
        R
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold tracking-tight text-white">{org}</p>
        <p className="flex items-center gap-1.5 truncate text-[10px] font-medium text-indigo-100">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
          AI receptionist · Open now
        </p>
      </div>
    </div>
  );
}

function Chrome({ org }: { org: string }) {
  return (
    <div className="px-3 pt-7">
      <StatusBar />
      <AppHeader org={org} />
    </div>
  );
}

function SmsBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-indigo-600/90 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-lg shadow-indigo-950/40">
        {text}
      </p>
    </div>
  );
}

function OwnerCard({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-800/80 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-gray-300 shadow-xl shadow-black/50 backdrop-blur-sm">
      <p className="mb-1 text-[11px] font-semibold text-white">{lines[0]}</p>
      {lines.slice(1, 4).map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p className="mt-1.5 text-[10px] font-semibold text-green-400">Texted to your phone</p>
    </div>
  );
}

export default function PhoneShowcase({ app, bookedLine, confirmationSms, ownerSummary }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return; // static frame only — CSS already handles the layout

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const section = (stage.closest("section") as HTMLElement | null) ?? stage;

    let raf = 0;
    let tX = 0;
    let tY = 0;
    let cX = 0;
    let cY = 0;
    let tP = 0;
    let cP = 0;
    let lastGlow = -1;
    let needRect = true;
    let pointerX = 0;
    let pointerY = 0;
    let pointerDirty = false;
    let rect = section.getBoundingClientRect();

    const write = () => {
      stage.style.setProperty("--mx", cX.toFixed(4));
      stage.style.setProperty("--my", cY.toFixed(4));
      stage.style.setProperty("--p", cP.toFixed(4));
      const glow = Math.min(1, Math.abs(cX) * 0.6 + Math.abs(cY) * 0.4);
      if (Math.abs(glow - lastGlow) > 0.01) {
        lastGlow = glow;
        stage.style.setProperty("--glow", glow.toFixed(3));
      }
    };

    const frame = () => {
      raf = 0;
      if (needRect) {
        // one layout read per frame at most, only after scroll/resize
        rect = section.getBoundingClientRect();
        needRect = false;
      }
      if (pointerDirty) {
        pointerDirty = false;
        const halfW = rect.width / 2 || 1;
        const halfH = rect.height / 2 || 1;
        tX = Math.max(-1, Math.min(1, (pointerX - (rect.left + halfW)) / halfW));
        tY = Math.max(-1, Math.min(1, (pointerY - (rect.top + halfH)) / halfH));
      }
      // scroll parallax — lg+ only, derived from the cached rect (no reflow)
      tP = wide.matches ? Math.max(0, Math.min(1, -rect.top / (window.innerHeight || 1))) : 0;

      cX += (tX - cX) * 0.08;
      cY += (tY - cY) * 0.08;
      cP += (tP - cP) * 0.12;
      if (Math.abs(tX - cX) < 0.001) cX = tX;
      if (Math.abs(tY - cY) < 0.001) cY = tY;
      if (Math.abs(tP - cP) < 0.001) cP = tP;
      write();

      if (cX !== tX || cY !== tY || cP !== tP) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerDirty = true;
      kick();
    };

    const onPointerLeave = () => {
      tX = 0;
      tY = 0;
      kick();
    };

    const onScroll = () => {
      needRect = true;
      kick();
    };

    const onResize = () => {
      needRect = true;
      kick();
    };

    const onVisibility = () => {
      stage.classList.toggle("is-hidden", document.hidden);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          stage.classList.toggle("in-view", entry.isIntersecting);
        }
        if (stage.classList.contains("in-view")) kick();
      },
      { threshold: 0.12 },
    );
    observer.observe(stage);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    if (finePointer.matches) {
      section.addEventListener("pointermove", onPointerMove, { passive: true });
      section.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex w-full flex-col items-center">
      {/* Decorative: the entire phone is hidden from assistive tech and holds nothing focusable. */}
      <div ref={stageRef} className="phone-stage lg:w-[105%]" aria-hidden="true">
        <div className="phone-glow">
          <div className="phone-glow-inner" />
        </div>

        <div className="phone-tilt">
          <div className="phone-lift">
            <div className="phone-float">
              <div className="phone-sway">
                <div className="phone-body">
                  <div className="phone-screen">
                    {/* ── static frame: no JS / prefers-reduced-motion ── */}
                    <div className="screen-static">
                      <Chrome org={app.org} />
                      <div className="px-3 pt-6">
                        <div className="flex justify-center">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-gray-300">
                            {CALL_ENDED}
                          </span>
                        </div>
                        <div className="mt-6">
                          <SmsBubble text={confirmationSms} />
                        </div>
                        <div className="mt-4">
                          <OwnerCard lines={ownerSummary} />
                        </div>
                      </div>
                    </div>

                    {/* ── 16s story (single master clock) ── */}
                    <div className="beat s-idle">
                      <Chrome org={app.org} />
                      <div className="px-6 pt-8 text-center">
                        <p className="text-[13px] leading-relaxed text-gray-300">
                          Answered 24/7 in English &amp; Spanish.
                        </p>
                      </div>
                      <div className="phone-watermark">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>

                    <div className="beat s-call">
                      <div className="rounded-2xl border border-white/10 bg-gray-800/95 px-3 py-3 shadow-2xl shadow-black/50">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                            <span className="call-ring" />
                            <span className="call-ring call-ring-2" />
                            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white">
                              {app.caller.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-white">{app.caller}</p>
                            <p className="truncate text-[11px] text-gray-300">{app.phone}</p>
                            <p className="truncate text-[10px] text-gray-400">
                              Incoming call · Saturday, 7:02 PM
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-green-500 px-3 py-1.5 text-[11px] font-bold text-white">
                            Answer
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="beat s-live">
                      <div className="rounded-2xl border border-white/10 bg-gray-800/95 px-3 py-3 shadow-2xl shadow-black/50">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-green-400">
                            Answered
                          </span>
                          <div className="flex h-5 items-end gap-[3px]">
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                            <span className="wave-bar" />
                          </div>
                        </div>
                        <p className="mt-2.5 text-[11px] leading-relaxed text-gray-200">{bookedLine}</p>
                      </div>
                    </div>

                    <div className="beat s-chip">
                      <div className="flex justify-center">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-gray-300">
                          {CALL_ENDED}
                        </span>
                      </div>
                    </div>

                    <div className="beat s-sms">
                      <SmsBubble text={confirmationSms} />
                    </div>

                    <div className="beat s-welcome">
                      <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-semibold text-indigo-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        {REPEAT_TAG}
                      </span>
                      <SmsBubble text={`Welcome back, ${app.caller}!`} />
                    </div>

                    <div className="beat s-owner">
                      <OwnerCard lines={ownerSummary} />
                    </div>

                    <div className="beat s-loop" />
                  </div>

                  <div className="phone-notch" />
                  <div className="phone-home-bar" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direction C: the demo-call CTA directly under the phone */}
      <a
        href="tel:+17279667556"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition hover:bg-green-500/20 hover:text-green-200"
      >
        <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
        Call the demo line
        <span className="text-base font-bold tracking-wide text-green-400">(727) 966-7556</span>
      </a>
      <p className="mt-3 text-center text-[11px] text-gray-500">
        Illustrative example — sample names and times are placeholders.
      </p>
    </div>
  );
}

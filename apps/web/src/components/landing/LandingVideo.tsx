import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useTranslate } from "@tolgee/react";

import { cn } from "@/lib/utils";

// =====================================================================
//  LandingVideo — editorial product demonstration block.
//
//  Click-to-play poster on top of the native <video> so the page itself
//  stays light (preload="metadata") and the viewer chooses when to
//  spend bandwidth + attention. Once playing, native controls take
//  over — no custom controller surface to keep the chrome calm.
// =====================================================================

export function LandingVideo() {
  const { t } = useTranslate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      /* user gesture missing on some browsers — controls are still visible */
    });
    setPlaying(true);
  }

  return (
    <section id="video" className="mx-auto max-w-7xl px-6 py-24">
      <header className="mb-10 flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="smallcaps text-[11px] text-ink-mute">
            {t("landing.video.eyebrow")}
          </span>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-5xl">
            {t("landing.video.title.line1")}{" "}
            <span className="text-ink-mute italic">
              {t("landing.video.title.line2")}
            </span>
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-dim md:text-right">
          {t("landing.video.intro")}
        </p>
      </header>

      <div className="relative">
        {/* atmospheric glow behind the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-leaf/10 via-transparent to-amber/15 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl border border-line/70 bg-bg-elevated shadow-glass"
        >
          <video
            ref={videoRef}
            src="/videos/demonstration.mp4"
            preload="metadata"
            playsInline
            controls={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="block aspect-video w-full bg-bg"
          />

          {/* Click-to-play overlay — only when not yet playing */}
          {!playing && (
            <button
              type="button"
              onClick={play}
              className="group absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-bg/10 to-bg/40 transition-colors hover:bg-bg/20 focus-ring"
              aria-label={t("landing.video.play")}
            >
              <span
                className={cn(
                  "grid h-20 w-20 place-items-center rounded-full",
                  "border border-leaf/60 bg-leaf/15 backdrop-blur",
                  "shadow-glow transition-transform duration-300",
                  "group-hover:scale-105 group-active:scale-95",
                )}
              >
                <Play className="h-7 w-7 translate-x-[2px] fill-leaf text-leaf" />
              </span>
              <span className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-[11px] uppercase tracking-widest text-ink-mute">
                <span className="smallcaps">{t("landing.video.duration")}</span>
                <span className="smallcaps">{t("landing.video.format")}</span>
              </span>
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}

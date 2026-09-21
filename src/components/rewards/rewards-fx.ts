const STYLE_ID = 'adventura-rewards-fx';

const CSS = `
@keyframes adv-aura-drift {
  0% { transform: translate3d(-6%, -4%, 0) scale(1); }
  50% { transform: translate3d(8%, 6%, 0) scale(1.08); }
  100% { transform: translate3d(-6%, -4%, 0) scale(1); }
}
@keyframes adv-aura-drift-alt {
  0% { transform: translate3d(10%, 8%, 0) rotate(0deg); }
  100% { transform: translate3d(-12%, -10%, 0) rotate(18deg); }
}
@keyframes adv-star-twinkle {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.9; }
}
@keyframes adv-scan {
  0% { transform: translateY(-120%); }
  100% { transform: translateY(220%); }
}
@keyframes adv-grid-pulse {
  0%, 100% { opacity: 0.28; }
  50% { opacity: 0.55; }
}
@keyframes adv-rune-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes adv-rune-counter {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}
@keyframes adv-ember {
  0% { transform: translateY(8px) scale(0.7); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(-42px) scale(1.15); opacity: 0; }
}
@keyframes adv-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes adv-glow-breathe {
  0%, 100% { opacity: 0.28; }
  50% { opacity: 0.48; }
}
@keyframes adv-crit-burst {
  0% { transform: scale(0.2); opacity: 0; }
  18% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1.65); opacity: 0; }
}
@keyframes adv-crit-ring {
  0% { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes adv-orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes adv-orbit-rev {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}
@keyframes adv-petal-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes adv-petal-fall {
  0% { transform: translate3d(-18px, -40px, 0) rotate(-16deg); opacity: 0; }
  8% { opacity: 1; }
  55% { transform: translate3d(52px, 380px, 0) rotate(150deg); }
  100% { transform: translate3d(-24px, 760px, 0) rotate(310deg); opacity: 0; }
}
@keyframes adv-rain-drop {
  0% { transform: translate3d(0, -50px, 0); opacity: 0; }
  6% { opacity: 0.95; }
  100% { transform: translate3d(10px, 820px, 0); opacity: 0; }
}
@keyframes adv-fx-petal-drop {
  0% { transform: translate3d(-8px, -24px, 0) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate3d(22px, 140px, 0) rotate(250deg); opacity: 0; }
}
@keyframes adv-bolt-flicker {
  0%, 86%, 100% { opacity: 0; }
  88% { opacity: 1; }
  90% { opacity: 0.15; }
  92% { opacity: 1; }
  94% { opacity: 0; }
}
@keyframes adv-eclipse {
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50% { transform: scale(1.08); opacity: 0.85; }
}
@keyframes adv-foil-sweep {
  0% { transform: translateX(-80%) rotate(18deg); }
  100% { transform: translateX(180%) rotate(18deg); }
}
@keyframes adv-pixel-blink {
  0%, 100% { opacity: 0.15; }
  40% { opacity: 1; }
  55% { opacity: 0.2; }
  70% { opacity: 0.9; }
}
@keyframes adv-wave-run {
  0% { transform: rotate(0deg) scale(1); opacity: 0.55; }
  50% { transform: rotate(180deg) scale(1.04); opacity: 0.9; }
  100% { transform: rotate(360deg) scale(1); opacity: 0.55; }
}
@keyframes adv-mist-drift {
  0% { transform: translate3d(-8%, 6%, 0) scale(1); opacity: 0.25; }
  50% { transform: translate3d(10%, -8%, 0) scale(1.15); opacity: 0.5; }
  100% { transform: translate3d(-8%, 6%, 0) scale(1); opacity: 0.25; }
}
@keyframes adv-gear-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes adv-rain-fall {
  from { background-position: 0 0; }
  to { background-position: 12px 36px; }
}
@keyframes adv-flash {
  0%, 82%, 100% { opacity: 0; }
  84% { opacity: 0.55; }
  86% { opacity: 0; }
  88% { opacity: 0.7; }
  91% { opacity: 0; }
}
@keyframes adv-vignette-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.85; }
}
@keyframes adv-hue {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}
@keyframes adv-matrix {
  from { background-position: 0 0; }
  to { background-position: 0 80px; }
}
@keyframes adv-firefly {
  0%, 100% { opacity: 0.1; transform: translate3d(0, 0, 0) scale(0.7); }
  40% { opacity: 1; transform: translate3d(6px, -10px, 0) scale(1.15); }
  70% { opacity: 0.25; transform: translate3d(-8px, 4px, 0) scale(0.8); }
}
@keyframes adv-caustic {
  0% { transform: translate3d(-8%, -4%, 0) scale(1.05) rotate(0deg); }
  50% { transform: translate3d(10%, 8%, 0) scale(1.18) rotate(12deg); }
  100% { transform: translate3d(-8%, -4%, 0) scale(1.05) rotate(0deg); }
}
@keyframes adv-magma {
  0% { transform: translate3d(0, 18%, 0) scale(1); }
  50% { transform: translate3d(6%, 4%, 0) scale(1.12); }
  100% { transform: translate3d(-4%, 16%, 0) scale(1); }
}
@keyframes adv-hearth {
  0%, 100% { opacity: 0.42; transform: scale(1); }
  50% { opacity: 0.95; transform: scale(1.07); }
}
@keyframes adv-dragon-perch {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -5px, 0); }
}
@keyframes adv-mug-clink-left {
  0%, 58%, 100% { transform: rotate(-12deg); }
  66% { transform: rotate(-4deg) translate3d(3px, -2px, 0); }
  74% { transform: rotate(-14deg); }
}
@keyframes adv-mug-clink-right {
  0%, 58%, 100% { transform: rotate(12deg); }
  66% { transform: rotate(4deg) translate3d(-3px, -2px, 0); }
  74% { transform: rotate(14deg); }
}
@keyframes adv-mug-sway-left {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(-6deg); }
}
@keyframes adv-mug-sway-right {
  0%, 100% { transform: rotate(10deg); }
  50% { transform: rotate(6deg); }
}
@keyframes adv-foam-burst {
  0%, 56%, 100% { opacity: 0; transform: translate(-50%, -40%) scale(0.25); }
  63% { opacity: 1; transform: translate(-50%, -58%) scale(1.12); }
  82% { opacity: 0.2; transform: translate(-50%, -78%) scale(1.55); }
}
@keyframes adv-foam-rise {
  0% { transform: translateY(8px) scale(0.6); opacity: 0; }
  24% { opacity: 0.95; }
  100% { transform: translateY(-38px) scale(1.15); opacity: 0; }
}

.adv-aura {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
  -webkit-mask-image: radial-gradient(ellipse 78% 72% at 50% 42%, transparent 36%, #000 78%);
          mask-image: radial-gradient(ellipse 78% 72% at 50% 42%, transparent 36%, #000 78%);
}
.adv-aura--aurora,
.adv-aura--neon_grid,
.adv-aura--void_runes,
.adv-aura--sakura_mist,
.adv-aura--storm_veil,
.adv-aura--blood_haze,
.adv-aura--prism_shift,
.adv-aura--pixel_rain,
.adv-aura--forest_glow,
.adv-aura--tide_caustic,
.adv-aura--ghost_fog,
.adv-aura--magma_flow,
.adv-aura--star_field,
.adv-aura--oak_shield {
  background: none;
}
.adv-aura-blob {
  position: absolute;
  width: 38%;
  height: 38%;
  border-radius: 50%;
  opacity: 0.35;
  filter: blur(28px);
  animation: adv-aura-drift 9s ease-in-out infinite;
}
.adv-aura-blob.alt {
  width: 32%;
  height: 32%;
  animation: adv-aura-drift-alt 14s linear infinite;
  filter: blur(24px);
}
.adv-aura-stars span {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #fff;
  border-radius: 50%;
  animation: adv-star-twinkle 2.8s ease-in-out infinite;
}
.adv-aura-grid {
  position: absolute;
  inset: -20%;
  opacity: 0.45;
  background-image:
    linear-gradient(rgba(57,243,255,0.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(57,243,255,0.16) 1px, transparent 1px);
  background-size: 28px 28px;
  transform: perspective(500px) rotateX(58deg) translateY(18%);
  animation: adv-grid-pulse 3.4s ease-in-out infinite;
}
.adv-aura-scan {
  position: absolute;
  left: 0; right: 0; height: 18%;
  background: linear-gradient(to bottom, transparent, rgba(57,243,255,0.16), transparent);
  animation: adv-scan 3.6s linear infinite;
}
.adv-aura-runes {
  position: absolute;
  inset: 0;
  border: 1.5px dashed rgba(192,132,252,0.5);
  border-radius: 14px;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 12px), #000 calc(100% - 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 12px), #000 calc(100% - 1px));
  animation: adv-rune-spin 22s linear infinite;
}
.adv-aura-runes.inner {
  inset: 8px;
  border-style: dotted;
  animation: adv-rune-counter 16s linear infinite;
}
.adv-ember {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F5D0FE;
  box-shadow: 0 0 6px rgba(192,132,252,0.55);
  animation: adv-ember 2.8s ease-in infinite;
}
.adv-ember:nth-child(2n) { width: 4px; height: 4px; animation-duration: 2.2s; }
.adv-ember:nth-child(3n) { width: 8px; height: 8px; animation-duration: 3.4s; }
.adv-ember.magma {
  background: #FDBA74;
  box-shadow: 0 0 6px rgba(234,88,12,0.55);
}
.adv-ember.oak {
  background: #F6E2B3;
  box-shadow: 0 0 6px rgba(196,122,58,0.55);
}

.adv-aura-petal {
  position: absolute;
  width: 18px;
  height: 26px;
  border-radius: 80% 0 72% 28%;
  background: linear-gradient(135deg, #fff1f2 8%, #fda4af 42%, #f472b6 78%, #be185d);
  box-shadow: 0 0 4px rgba(244,114,182,0.35);
  animation: adv-petal-fall 6.2s linear infinite;
}
.adv-aura-petal:nth-child(2n) {
  width: 13px;
  height: 19px;
  background: linear-gradient(135deg, #ffe4e6, #fb7185);
  animation-duration: 7.6s;
}
.adv-aura-petal:nth-child(3n) {
  width: 22px;
  height: 32px;
  animation-duration: 8.4s;
}
.adv-aura-petal:nth-child(4n) {
  background: linear-gradient(135deg, #fecdd3, #fff, #f9a8d4);
  animation-duration: 5.1s;
}
.adv-aura-petal:nth-child(5n) {
  width: 10px;
  height: 15px;
  animation-duration: 4.6s;
}
.adv-aura-rain {
  position: absolute;
  inset: -20%;
  background-image: repeating-linear-gradient(
    102deg,
    transparent 0 14px,
    rgba(219,234,254,0.0) 14px,
    rgba(191,219,254,0.55) 16px,
    transparent 17px 32px
  );
  opacity: 0.4;
  animation: adv-rain-fall 0.32s linear infinite;
}
.adv-aura-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 70% 18%, rgba(255,255,255,0.18), transparent 36%);
  animation: adv-flash 4.2s steps(1, end) infinite;
}
.adv-aura-drop {
  position: absolute;
  width: 2px;
  height: 28px;
  border-radius: 2px;
  background: linear-gradient(to bottom, transparent, rgba(224,242,254,0.95) 40%, rgba(96,165,250,0.9));
  animation: adv-rain-drop 1.05s linear infinite;
}
.adv-aura-drop:nth-child(3n) { height: 38px; animation-duration: 0.82s; }
.adv-aura-drop:nth-child(4n) { height: 18px; width: 1.5px; animation-duration: 1.28s; }
.adv-aura-drop.blood {
  width: 4px;
  height: 22px;
  background: linear-gradient(to bottom, transparent, rgba(251,113,133,0.95) 35%, rgba(159,18,57,0.95));
  border-radius: 40% 40% 60% 60%;
  animation-duration: 1.7s;
}
.adv-aura-drop.blood:nth-child(3n) { width: 6px; height: 28px; }

.adv-aura-bolt {
  position: absolute;
  width: 22px;
  height: 64px;
  background: linear-gradient(180deg, #fff, #93c5fd);
  clip-path: polygon(58% 0, 22% 46%, 46% 46%, 28% 100%, 78% 40%, 50% 40%);
  filter: drop-shadow(0 0 3px rgba(96,165,250,0.45));
  animation: adv-bolt-flicker 3.1s linear infinite;
}
.adv-aura-bolt:nth-child(2n) { width: 16px; height: 48px; animation-delay: -1.1s; }
.adv-aura-bolt:nth-child(3n) { transform: scaleX(-1); animation-duration: 4.4s; }

.adv-aura-vignette {
  position: absolute;
  inset: -8%;
  background: radial-gradient(circle, transparent 62%, rgba(127,29,29,0.22) 100%);
  animation: adv-vignette-pulse 3.2s ease-in-out infinite;
}

.adv-aura-foil {
  position: absolute;
  inset: -20% -40%;
  background: linear-gradient(110deg, transparent 20%, rgba(196,181,253,0.12) 36%, rgba(255,255,255,0.22) 48%, rgba(125,211,252,0.12) 58%, transparent 72%);
  animation: adv-foil-sweep 3.8s linear infinite;
}
.adv-aura-foil.alt {
  animation-duration: 5.6s;
  animation-direction: reverse;
  opacity: 0.7;
}

.adv-aura-shard {
  position: absolute;
  width: 12px;
  height: 18px;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
  box-shadow: 0 0 8px rgba(196,181,253,0.8);
  animation: adv-petal-fall 4.4s linear infinite, adv-hue 6s linear infinite;
}
.adv-aura-shard:nth-child(2n) { width: 8px; height: 12px; animation-duration: 5.6s, 8s; }
.adv-aura-shard:nth-child(3n) { width: 16px; height: 22px; }

.adv-aura-matrix {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 18px,
    rgba(74,222,128,0.12) 18px 20px
  );
  opacity: 0.55;
}
.adv-aura-glyph {
  position: absolute;
  width: 12px;
  height: 18px;
  color: #4ade80;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 8px #22c55e, 0 0 16px #16a34a;
  animation: adv-rain-drop 2.6s linear infinite;
}
.adv-aura-glyph::after { content: '0'; }
.adv-aura-glyph:nth-child(2n)::after { content: '1'; }
.adv-aura-glyph:nth-child(3n)::after { content: '7'; }
.adv-aura-glyph:nth-child(4n)::after { content: 'A'; }
.adv-aura-glyph:nth-child(5n)::after { content: 'カ'; font-size: 13px; }
.adv-aura-glyph:nth-child(6n)::after { content: 'Z'; }
.adv-aura-glyph:nth-child(7n) { color: #bbf7d0; animation-duration: 3.4s; }

.adv-aura-leaf {
  position: absolute;
  width: 16px;
  height: 22px;
  border-radius: 0 72% 0 72%;
  background: linear-gradient(160deg, #d9f99d, #65a30d 55%, #365314);
  box-shadow: 0 0 8px rgba(132,204,22,0.55);
  animation: adv-petal-fall 7.2s linear infinite;
}
.adv-aura-leaf:nth-child(2n) { width: 11px; height: 16px; background: linear-gradient(160deg, #bef264, #3f6212); animation-duration: 8.6s; }
.adv-aura-leaf:nth-child(3n) { width: 20px; height: 26px; animation-duration: 9.4s; }

.adv-aura-firefly {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ecfccb;
  box-shadow: 0 0 4px rgba(163,230,53,0.45);
  animation: adv-firefly 3.6s ease-in-out infinite;
}
.adv-aura-firefly:nth-child(2n) { width: 4px; height: 4px; animation-duration: 4.8s; }
.adv-aura-firefly:nth-child(3n) { width: 10px; height: 10px; animation-duration: 2.8s; }

.adv-aura-spark {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px currentColor;
  animation: adv-star-twinkle 2.2s ease-in-out infinite;
}
.adv-aura-spark:nth-child(3n) { width: 3px; height: 3px; }
.adv-aura-spark:nth-child(4n) { width: 7px; height: 7px; }
.adv-aura-spark.gold { background: #fde68a; color: #fbbf24; }
.adv-aura-spark.cyan { background: #a5f3fc; color: #22d3ee; }
.adv-aura-spark.rose { background: #fda4af; color: #e11d48; }
.adv-aura-spark.lime { background: #d9f99d; color: #84cc16; }
.adv-aura-spark.pale { background: #f8fafc; color: #cbd5e1; }
.adv-aura-spark.prism {
  background: #fff;
  animation: adv-star-twinkle 2.2s ease-in-out infinite, adv-hue 5s linear infinite;
}

.adv-aura-star {
  position: absolute;
  width: 11px;
  height: 11px;
  background: #fde68a;
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  filter: drop-shadow(0 0 3px rgba(251,191,36,0.45));
  animation: adv-star-twinkle 2.8s ease-in-out infinite, adv-petal-spin 9s linear infinite;
}
.adv-aura-star:nth-child(2n) { width: 7px; height: 7px; }

.adv-aura-wisp {
  position: absolute;
  width: 42px;
  height: 18px;
  border-radius: 50%;
  background: rgba(248,250,252,0.28);
  filter: blur(6px);
  animation: adv-mist-drift 7s ease-in-out infinite;
}
.adv-aura-wisp:nth-child(2n) { width: 28px; height: 12px; animation-duration: 9s; }

.adv-aura-bubble {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid rgba(165,243,252,0.85);
  background: rgba(165,243,252,0.18);
  animation: adv-ember 3.4s ease-in infinite;
}
.adv-aura-bubble:nth-child(2n) { width: 7px; height: 7px; animation-duration: 2.6s; }
.adv-aura-bubble:nth-child(3n) { width: 18px; height: 18px; animation-duration: 4.4s; }

.adv-aura-caustic {
  position: absolute;
  width: 46%;
  height: 32%;
  left: -6%;
  top: 8%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34,211,238,0.16), transparent 62%);
  filter: blur(16px);
  animation: adv-caustic 7s ease-in-out infinite;
}
.adv-aura-caustic.alt {
  left: 58%;
  top: auto;
  bottom: 6%;
  background: radial-gradient(circle, rgba(125,211,252,0.14), transparent 64%);
  animation-duration: 9s;
  animation-direction: reverse;
}

.adv-aura-fog {
  position: absolute;
  width: 42%;
  height: 28%;
  border-radius: 50%;
  background: rgba(226,232,240,0.12);
  filter: blur(20px);
  animation: adv-mist-drift 10s ease-in-out infinite;
}
.adv-aura-fog.alt { right: -8%; top: 6%; animation-duration: 13s; }
.adv-aura-fog.late { left: 8%; bottom: -8%; animation-delay: -4s; }

.adv-aura-magma {
  position: absolute;
  left: -8%;
  right: -8%;
  bottom: -22%;
  height: 28%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 80%, rgba(251,146,60,0.28), rgba(127,29,29,0.0) 70%);
  filter: blur(14px);
  animation: adv-magma 5s ease-in-out infinite;
}
.adv-aura-magma.alt {
  height: 20%;
  background: radial-gradient(circle at 30% 90%, rgba(250,204,21,0.16), transparent 68%);
  animation-duration: 6.4s;
}

.adv-aura-wood {
  position: absolute;
  inset: -8%;
  opacity: 0.28;
  background:
    radial-gradient(ellipse 80% 70% at 50% 18%, rgba(246, 226, 179, 0.22), transparent 52%),
    repeating-linear-gradient(
      90deg,
      rgba(74, 37, 12, 0) 0 18px,
      rgba(42, 20, 8, 0.16) 18px 19px,
      rgba(212, 160, 90, 0.08) 19px 20px,
      rgba(74, 37, 12, 0) 21px 34px
    );
  -webkit-mask-image: radial-gradient(ellipse 72% 68% at 50% 42%, transparent 42%, #000 86%);
          mask-image: radial-gradient(ellipse 72% 68% at 50% 42%, transparent 42%, #000 86%);
}
.adv-aura-foam {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fffdf6, #f6e2b3 62%, transparent 72%);
  box-shadow: 0 0 6px rgba(246, 226, 179, 0.55);
  animation: adv-foam-rise 2.8s ease-in infinite;
}
.adv-aura-foam:nth-child(2n) { width: 6px; height: 6px; animation-duration: 2.2s; }
.adv-aura-foam:nth-child(3n) { width: 14px; height: 14px; animation-duration: 3.4s; }

.adv-fx .adv-mug,
.adv-card-fx .adv-mug,
.adv-fx .adv-foam,
.adv-card-fx .adv-foam,
.adv-crit-burst .adv-mug,
.adv-crit-burst .adv-foam {
  position: absolute;
}
.adv-mug {
  width: 16px;
  height: 20px;
  z-index: 4;
  overflow: visible;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  border-radius: 0;
  box-shadow: none;
  filter: drop-shadow(0 1px 1px rgba(28, 12, 4, 0.45));
  transform-origin: 50% 88%;
}
.adv-mug::before,
.adv-mug::after {
  content: none;
  display: none;
}
.adv-mug.is-left { animation: adv-mug-clink-left 3.2s ease-in-out infinite; }
.adv-mug.is-right { animation: adv-mug-clink-right 3.2s ease-in-out infinite; }
.adv-mugs.is-mini .adv-mug.is-left { animation: adv-mug-sway-left 3.4s ease-in-out infinite; }
.adv-mugs.is-mini .adv-mug.is-right { animation: adv-mug-sway-right 3.4s ease-in-out infinite; }
.adv-mugs.is-mini .adv-foam,
.adv-mugs.is-compact .adv-foam { display: none; }
.adv-foam {
  position: absolute;
  width: 22px;
  height: 22px;
  z-index: 5;
  pointer-events: none;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 55%, rgba(255,246,214,0.95) 0 18%, transparent 42%),
    radial-gradient(circle at 30% 40%, #fff 0 10%, transparent 18%),
    radial-gradient(circle at 70% 38%, #fff8e7 0 8%, transparent 16%);
  animation: adv-foam-burst 2.8s ease-out infinite;
  filter: drop-shadow(0 0 4px rgba(246,226,179,0.55));
}

.adv-card-fx:not(.is-wide) .adv-card-shield,
.adv-card-fx:not(.is-wide) .adv-card-rivet {
  display: none;
}
.adv-founding-dragon {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  filter: drop-shadow(0 6px 10px rgba(20, 4, 0, 0.5));
  animation: adv-dragon-perch 3.6s ease-in-out infinite;
}
.adv-card-shield {
  pointer-events: none;
  z-index: 3;
}
.adv-card-shield::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -14px;
  width: 18px;
  height: 16px;
  transform: translateX(-50%);
  background:
    linear-gradient(180deg, #f6e2b3 0%, #e8c36a 34%, #c9a227 58%, #8b4a1c 86%, #3d1c0a 100%);
  clip-path: polygon(10% 18%, 50% 0, 90% 18%, 84% 72%, 50% 100%, 16% 72%);
  filter: drop-shadow(0 1px 0 #1c0c04) drop-shadow(0 2px 3px rgba(0,0,0,0.32));
}
.adv-card-rivet {
  position: absolute;
  width: 7px;
  height: 7px;
  z-index: 3;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #f6e2b3, #c9a227 42%, #8b4a1c 72%, #2a1408 100%);
  box-shadow: 0 0 0 1px #1c0c04, 0 1px 2px rgba(0,0,0,0.4);
}

.adv-fx-spoke {
  position: absolute;
  left: 50%;
  top: 50%;
  height: 0;
  margin: 0;
  padding: 0;
  background: none;
  box-shadow: none;
  pointer-events: none;
  transform-origin: 0 0;
  animation: adv-orbit 8s linear infinite;
}
.adv-fx-spoke.is-inner { width: 36%; }
.adv-fx-spoke.is-rev { animation-name: adv-orbit-rev; }
.adv-fx-spoke::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
.adv-fx-petal::after {
  width: 12px;
  height: 16px;
  border-radius: 80% 0 70% 30%;
  background: linear-gradient(135deg, #fff1f2, #f472b6 60%, #be185d);
  box-shadow: 0 0 5px rgba(244,114,182,0.45);
}
.adv-fx-spoke.is-inner.adv-fx-petal::after {
  width: 8px;
  height: 11px;
}
.adv-fx-leaf::after {
  width: 12px;
  height: 16px;
  border-radius: 0 70% 0 70%;
  background: linear-gradient(160deg, #d9f99d, #4d7c0f);
  box-shadow: 0 0 4px rgba(132,204,22,0.4);
}
.adv-fx-spoke.is-inner.adv-fx-leaf::after {
  width: 8px;
  height: 11px;
}
.adv-fx-star::after {
  width: 6px;
  height: 6px;
  background: #fde68a;
  box-shadow: 0 0 5px #fbbf24;
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}
.adv-fx-star.cyan::after { background: #a5f3fc; box-shadow: 0 0 5px #22d3ee; clip-path: none; border-radius: 50%; }
.adv-fx-star.rose::after { background: #fda4af; box-shadow: 0 0 5px #e11d48; }
.adv-fx-star.gold::after { background: #fde68a; box-shadow: 0 0 5px #fbbf24; }
.adv-fx-star.pale::after { background: #f8fafc; box-shadow: 0 0 5px #cbd5e1; clip-path: none; border-radius: 50%; }
.adv-fx-star.prism::after {
  background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
  box-shadow: 0 0 5px #c4b5fd;
}
.adv-fx-pixel { animation-timing-function: steps(8, end); }
.adv-fx-pixel::after {
  width: 6px;
  height: 6px;
  background: #4ade80;
  box-shadow: 0 0 0 1px #14532d;
}
.adv-fx-pixel.teal::after { background: #2dd4bf; box-shadow: 0 0 0 1px #115e59; }
.adv-fx-rivet {
  animation: none !important;
}
.adv-fx-rivet::after {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, #f3d48a, #9a7028 50%, #3a220c 80%);
  box-shadow: 0 0 0 1px #2a1608, 0 1px 2px rgba(0,0,0,0.4);
}
.adv-fx-grain {
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(
      from 8deg,
      #2a1408 0 5deg,
      #6b3010 7deg,
      #c47a3a 10deg,
      #e8c36a 12deg,
      #8b4a1c 15deg,
      #3d1c0a 18deg
    );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 6.5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 6.5px));
  animation: adv-spin 32s linear infinite;
  opacity: 0.96;
}
.adv-fx-hearth {
  position: absolute;
  inset: -12%;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle, transparent 52%, rgba(255, 214, 120, 0.42) 64%, rgba(196, 122, 58, 0.16) 74%, transparent 84%);
  animation: adv-hearth 2.6s ease-in-out infinite;
  filter: blur(3px);
}
.adv-fx.is-mini .adv-fx-grain {
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 4px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 4px));
}
.adv-fx.is-compact .adv-fx-grain {
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 5px));
}

.adv-fx.is-mini .adv-fx-petal::after { width: 6px; height: 8px; box-shadow: none; }
.adv-fx.is-mini .adv-fx-leaf::after { width: 6px; height: 8px; box-shadow: none; }
.adv-fx.is-mini .adv-fx-star::after { width: 3px; height: 3px; box-shadow: 0 0 3px currentColor; }
.adv-fx.is-mini .adv-fx-pixel::after { width: 3px; height: 3px; }
.adv-fx.is-mini .adv-fx-rivet::after { width: 4px; height: 4px; }
.adv-fx.is-mini .adv-fx-glow { inset: -4%; filter: blur(5px); }
.adv-fx.is-mini .adv-fx-gear { border-width: 2px; }
.adv-fx.is-mini .adv-fx-gear.inner { inset: 5px; border-width: 2px; }
.adv-fx.is-compact .adv-fx-petal::after { width: 8px; height: 11px; }
.adv-fx.is-compact .adv-fx-leaf::after { width: 8px; height: 11px; }
.adv-fx.is-compact .adv-fx-star::after { width: 4px; height: 4px; }

.adv-fx-bolt {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background:
    conic-gradient(from 40deg, transparent 0 8%, #dbeafe 9%, transparent 11% 100%);
  filter: drop-shadow(0 0 6px #60a5fa);
  animation: adv-bolt-flicker 2.8s linear infinite;
}
.adv-fx-bolt.alt {
  transform: scaleX(-1);
  animation-delay: 0.9s;
  background: conic-gradient(from 210deg, transparent 0 10%, #93c5fd 11%, transparent 13% 100%);
}
.adv-fx-bolt.late { animation-delay: 1.7s; }

.adv-fx-eclipse {
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 58%, rgba(225,29,72,0.55) 72%, transparent 80%);
  animation: adv-eclipse 2.6s ease-in-out infinite;
}

.adv-fx-foil {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #f472b6, #60a5fa, #34d399, #facc15, #c084fc, #f472b6);
  opacity: 0.9;
  animation: adv-spin 4s linear infinite, adv-hue 8s linear infinite;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 4px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 4px));
}

.adv-fx-wave {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 3px solid rgba(6,182,212,0.0);
  box-shadow: inset 0 0 0 2px rgba(103,232,249,0.55);
  animation: adv-wave-run 4.2s linear infinite;
}
.adv-fx-wave.alt {
  inset: 8px;
  animation-duration: 6s;
  animation-direction: reverse;
  box-shadow: inset 0 0 0 2px rgba(14,165,233,0.4);
}

.adv-fx-mist {
  position: absolute;
  width: 70%;
  height: 70%;
  left: -8%;
  top: 10%;
  border-radius: 50%;
  background: rgba(226,232,240,0.35);
  filter: blur(12px);
  animation: adv-mist-drift 6s ease-in-out infinite;
}
.adv-fx-mist.alt {
  left: 38%;
  top: -6%;
  animation-duration: 8s;
}

.adv-fx-gear {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 4px dashed #d97706;
  animation: adv-gear-spin 8s linear infinite;
  opacity: 0.9;
}
.adv-fx-gear.inner {
  inset: 8px;
  border-width: 3px;
  border-style: dotted;
  animation-direction: reverse;
  animation-duration: 5.5s;
  border-color: #fbbf24;
}

.adv-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 50%;
  overflow: visible;
}
.adv-fx-glow {
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  filter: blur(8px);
  animation: adv-glow-breathe 4.5s ease-in-out infinite;
}
.adv-fx-track {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 2.5px solid var(--fx-accent);
  opacity: 0.82;
  pointer-events: none;
}
.adv-fx-spin {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 5.5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 5.5px));
}
.adv-fx-conic {
  position: absolute;
  inset: -40%;
  animation: adv-spin 9s linear infinite;
  will-change: transform;
}
.adv-fx-rim {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    0 0 12px color-mix(in srgb, var(--fx-accent) 55%, transparent),
    inset 0 0 0 1.5px color-mix(in srgb, var(--fx-accent) 70%, white);
}

.adv-fx--alpha_runes { --fx-accent: #e8c36a; --fx-accent-deep: #c99214; }
.adv-fx--alpha_runes .adv-fx-glow {
  background: radial-gradient(circle, rgba(232,195,106,0.5), transparent 68%);
}
.adv-fx--alpha_runes .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 62%, #e8c36a 76%, #fff6d6 84%, #e8c36a 90%, transparent 100%);
}

.adv-fx--neon_scan { --fx-accent: #12c4d8; --fx-accent-deep: #0891b2; }
.adv-fx--neon_scan .adv-fx-glow {
  background: radial-gradient(circle, rgba(18,196,216,0.42), transparent 68%);
}
.adv-fx--neon_scan .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 60%, #12c4d8 74%, #e6ffff 84%, #12c4d8 90%, transparent 100%);
}

.adv-fx--founding_embers { --fx-accent: #f97316; --fx-accent-deep: #c2410c; }
.adv-fx--founding_embers .adv-fx-glow {
  background: radial-gradient(circle, rgba(249,115,22,0.48), transparent 68%);
}
.adv-fx--founding_embers .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 60%, #f97316 74%, #ffe08a 84%, #f97316 90%, transparent 100%);
}

.adv-fx--solar_flare { --fx-accent: #f5a524; --fx-accent-deep: #c27800; }
.adv-fx--solar_flare .adv-fx-glow {
  background: radial-gradient(circle, rgba(245,165,36,0.5), transparent 68%);
}
.adv-fx--solar_flare .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 62%, #f5a524 76%, #fff4c2 84%, #f5a524 90%, transparent 100%);
}

.adv-fx--frost_ring { --fx-accent: #38bdf8; --fx-accent-deep: #0284c7; }
.adv-fx--frost_ring .adv-fx-glow {
  background: radial-gradient(circle, rgba(56,189,248,0.44), transparent 68%);
}
.adv-fx--frost_ring .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 62%, #38bdf8 76%, #f0f9ff 84%, #38bdf8 90%, transparent 100%);
}

.adv-fx--hex_circuit { --fx-accent: #14b8a6; --fx-accent-deep: #0f766e; }
.adv-fx--hex_circuit .adv-fx-glow {
  background: radial-gradient(circle, rgba(20,184,166,0.44), transparent 68%);
}
.adv-fx--hex_circuit .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 62%, #14b8a6 76%, #ecfdf5 84%, #14b8a6 90%, transparent 100%);
}

.adv-fx--void_orbit { --fx-accent: #8b5cf6; --fx-accent-deep: #6d28d9; }
.adv-fx--void_orbit .adv-fx-glow {
  background: radial-gradient(circle, rgba(139,92,246,0.46), transparent 68%);
}
.adv-fx--void_orbit .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 62%, #8b5cf6 76%, #f5d0fe 84%, #8b5cf6 90%, transparent 100%);
}

.adv-fx--sakura_fall { --fx-accent: #f472b6; --fx-accent-deep: #be185d; }
.adv-fx--sakura_fall .adv-fx-glow {
  background: radial-gradient(circle, rgba(244,114,182,0.48), transparent 68%);
}
.adv-fx--sakura_fall .adv-fx-conic {
  animation-duration: 14s;
  animation-direction: reverse;
  background: conic-gradient(from 0deg, transparent 0 50%, #f9a8d4 62%, #fff 74%, #f472b6 86%, transparent 100%);
}

.adv-fx--storm_arc { --fx-accent: #60a5fa; --fx-accent-deep: #1d4ed8; }
.adv-fx--storm_arc .adv-fx-glow {
  background: radial-gradient(circle, rgba(96,165,250,0.42), transparent 68%);
  animation-duration: 1.4s;
}
.adv-fx--storm_arc .adv-fx-conic {
  animation-duration: 2.2s;
  background: conic-gradient(from 0deg, transparent 0 70%, #dbeafe 78%, #60a5fa 86%, transparent 100%);
}
.adv-fx--storm_arc .adv-fx-track { border-style: dotted; }

.adv-fx--blood_moon { --fx-accent: #e11d48; --fx-accent-deep: #9f1239; }
.adv-fx--blood_moon .adv-fx-glow {
  background: radial-gradient(circle, rgba(225,29,72,0.5), transparent 70%);
  animation-duration: 2.4s;
}
.adv-fx--blood_moon .adv-fx-conic { display: none; }
.adv-fx--blood_moon .adv-fx-track {
  border-width: 4px;
  opacity: 0.95;
}

.adv-fx--prism_halo { --fx-accent: #c4b5fd; --fx-accent-deep: #7c3aed; }
.adv-fx--prism_halo .adv-fx-glow {
  background: radial-gradient(circle, rgba(196,181,253,0.5), transparent 68%);
}
.adv-fx--prism_halo .adv-fx-conic { display: none; }
.adv-fx--prism_halo .adv-fx-track { opacity: 0.35; }

.adv-fx--pixel_spark { --fx-accent: #4ade80; --fx-accent-deep: #15803d; }
.adv-fx--pixel_spark .adv-fx-glow {
  background: radial-gradient(circle, rgba(74,222,128,0.4), transparent 68%);
  animation: none;
  opacity: 0.55;
}
.adv-fx--pixel_spark .adv-fx-conic {
  animation: adv-spin 5.2s steps(8, end) infinite;
  background: conic-gradient(from 0deg, transparent 0 58%, #4ade80 70%, #ecfccb 78%, #4ade80 86%, transparent 100%);
}
.adv-fx--pixel_spark .adv-fx-track {
  border-style: dashed;
  border-width: 3px;
}

.adv-fx--leaf_crown { --fx-accent: #65a30d; --fx-accent-deep: #3f6212; }
.adv-fx--leaf_crown .adv-fx-glow {
  background: radial-gradient(circle, rgba(101,163,13,0.44), transparent 68%);
}
.adv-fx--leaf_crown .adv-fx-conic {
  animation-duration: 16s;
  background: conic-gradient(from 0deg, transparent 0 48%, #84cc16 60%, #ecfccb 72%, #65a30d 84%, transparent 100%);
}

.adv-fx--tide_ring { --fx-accent: #06b6d4; --fx-accent-deep: #0e7490; }
.adv-fx--tide_ring .adv-fx-glow {
  background: radial-gradient(circle, rgba(6,182,212,0.46), transparent 68%);
}
.adv-fx--tide_ring .adv-fx-conic { display: none; }

.adv-fx--ghost_veil { --fx-accent: #e2e8f0; --fx-accent-deep: #64748b; }
.adv-fx--ghost_veil .adv-fx-glow {
  background: radial-gradient(circle, rgba(226,232,240,0.42), transparent 70%);
}
.adv-fx--ghost_veil .adv-fx-conic {
  animation-duration: 18s;
  background: conic-gradient(from 0deg, transparent 0 55%, #f8fafc 70%, #cbd5e1 82%, transparent 100%);
}
.adv-fx--ghost_veil .adv-fx-track { opacity: 0.45; }

.adv-fx--copper_gear { --fx-accent: #d97706; --fx-accent-deep: #92400e; }
.adv-fx--copper_gear .adv-fx-glow {
  background: radial-gradient(circle, rgba(217,119,6,0.46), transparent 68%);
  animation: none;
  opacity: 0.55;
}
.adv-fx--copper_gear .adv-fx-conic { display: none; }
.adv-fx--copper_gear .adv-fx-track { display: none; }

.adv-fx--star_orbit { --fx-accent: #fbbf24; --fx-accent-deep: #b45309; }
.adv-fx--star_orbit .adv-fx-glow {
  background: radial-gradient(circle, rgba(251,191,36,0.5), transparent 68%);
}
.adv-fx--star_orbit .adv-fx-conic {
  animation-duration: 20s;
  background: conic-gradient(from 0deg, transparent 0 60%, #fbbf24 72%, #fff7ed 82%, #fbbf24 90%, transparent 100%);
}

.adv-fx--steel_band { --fx-accent: #6ba4e8; --fx-accent-deep: #3d7cc4; }
.adv-fx--steel_band .adv-fx-glow {
  opacity: 0.32;
  filter: blur(6px);
  background: radial-gradient(circle, rgba(107,164,232,0.2), transparent 74%);
}
.adv-fx--steel_band .adv-fx-conic {
  animation-duration: 22s;
  opacity: 0.55;
  background: conic-gradient(from 0deg, transparent 0 74%, #6ba4e8 84%, #c5ddf6 90%, transparent 96%);
}
.adv-fx--steel_band .adv-fx-track {
  border-width: 2px;
  opacity: 0.62;
}
.adv-fx--steel_band .adv-fx-rim {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fx-accent) 42%, white);
}

.adv-fx--oak_tankard { --fx-accent: #c47a3a; --fx-accent-deep: #6b3010; }
.adv-fx--oak_tankard .adv-fx-glow {
  animation-duration: 2.6s;
  background: radial-gradient(circle, rgba(232,195,106,0.58), rgba(196,122,58,0.22) 48%, transparent 72%);
}
.adv-fx--oak_tankard .adv-fx-conic {
  animation-duration: 6.5s;
  background: conic-gradient(from 0deg, transparent 0 42%, #8b4a1c 54%, #ffe08a 68%, #c47a3a 78%, transparent 90%);
}
.adv-fx--oak_tankard .adv-fx-track {
  border-width: 2px;
  border-color: #3d1c0a;
  opacity: 0.7;
}
.adv-fx--oak_tankard .adv-fx-rim {
  box-shadow:
    0 0 18px rgba(232,195,106,0.55),
    inset 0 0 0 2px #e8c36a,
    inset 0 0 0 4px #4a250c;
}

.adv-fx.is-static .adv-fx-spin {
  display: none;
}

@keyframes adv-glow-breathe-light {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

:root[data-theme="light"] .adv-fx-glow {
  inset: -12%;
  filter: blur(10px);
  animation-name: adv-glow-breathe-light;
}
:root[data-theme="light"] .adv-fx-track {
  border-color: var(--fx-accent-deep);
  border-width: 3px;
  opacity: 0.95;
}
:root[data-theme="light"] .adv-fx-rim {
  box-shadow:
    0 0 10px color-mix(in srgb, var(--fx-accent-deep) 42%, transparent),
    inset 0 0 0 1.5px color-mix(in srgb, var(--fx-accent-deep) 88%, black 8%);
}
:root[data-theme="light"] .adv-fx--steel_band .adv-fx-glow {
  opacity: 0.4;
  background: radial-gradient(circle, rgba(61,124,196,0.22), transparent 74%);
}
:root[data-theme="light"] .adv-fx--alpha_runes .adv-fx-glow {
  background: radial-gradient(circle, rgba(201,146,20,0.58), transparent 70%);
}
:root[data-theme="light"] .adv-fx--alpha_runes .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #c99214 70%, #f5d56a 82%, #c99214 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--neon_scan .adv-fx-glow {
  background: radial-gradient(circle, rgba(8,145,178,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--neon_scan .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #0891b2 70%, #67e8f9 82%, #0891b2 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--founding_embers .adv-fx-glow {
  background: radial-gradient(circle, rgba(194,65,12,0.52), transparent 70%);
}
:root[data-theme="light"] .adv-fx--founding_embers .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #c2410c 70%, #fb923c 82%, #c2410c 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--solar_flare .adv-fx-glow {
  background: radial-gradient(circle, rgba(194,120,0,0.55), transparent 70%);
}
:root[data-theme="light"] .adv-fx--solar_flare .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #c27800 70%, #fbbf24 82%, #c27800 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--frost_ring .adv-fx-glow {
  background: radial-gradient(circle, rgba(2,132,199,0.48), transparent 70%);
}
:root[data-theme="light"] .adv-fx--frost_ring .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #0284c7 70%, #7dd3fc 82%, #0284c7 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--hex_circuit .adv-fx-glow {
  background: radial-gradient(circle, rgba(15,118,110,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--hex_circuit .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #0f766e 70%, #2dd4bf 82%, #0f766e 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--void_orbit .adv-fx-glow {
  background: radial-gradient(circle, rgba(109,40,217,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--void_orbit .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 55%, #6d28d9 70%, #c4b5fd 82%, #6d28d9 90%, transparent 100%);
}
:root[data-theme="light"] .adv-fx--sakura_fall .adv-fx-glow {
  background: radial-gradient(circle, rgba(190,24,93,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--storm_arc .adv-fx-glow {
  background: radial-gradient(circle, rgba(29,78,216,0.45), transparent 70%);
}
:root[data-theme="light"] .adv-fx--blood_moon .adv-fx-glow {
  background: radial-gradient(circle, rgba(159,18,57,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--prism_halo .adv-fx-glow {
  background: radial-gradient(circle, rgba(124,58,237,0.42), transparent 70%);
}
:root[data-theme="light"] .adv-fx--pixel_spark .adv-fx-glow {
  background: radial-gradient(circle, rgba(21,128,61,0.45), transparent 70%);
}
:root[data-theme="light"] .adv-fx--leaf_crown .adv-fx-glow {
  background: radial-gradient(circle, rgba(63,98,18,0.48), transparent 70%);
}
:root[data-theme="light"] .adv-fx--tide_ring .adv-fx-glow {
  background: radial-gradient(circle, rgba(14,116,144,0.48), transparent 70%);
}
:root[data-theme="light"] .adv-fx--ghost_veil .adv-fx-glow {
  background: radial-gradient(circle, rgba(100,116,139,0.4), transparent 70%);
}
:root[data-theme="light"] .adv-fx--copper_gear .adv-fx-glow {
  background: radial-gradient(circle, rgba(146,64,14,0.48), transparent 70%);
}
:root[data-theme="light"] .adv-fx--star_orbit .adv-fx-glow {
  background: radial-gradient(circle, rgba(180,83,9,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-fx--oak_tankard .adv-fx-glow {
  background: radial-gradient(circle, rgba(201,146,20,0.55), rgba(107,48,16,0.22) 52%, transparent 72%);
}
:root[data-theme="light"] .adv-fx--oak_tankard .adv-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 40%, #6b3010 54%, #f5d56a 70%, #8b4a1c 82%, transparent 94%);
}

.adv-card-fx {
  position: relative;
  isolation: isolate;
}
.adv-card-fx-body {
  position: relative;
  z-index: 1;
}
.adv-card-fx-glow {
  position: absolute;
  inset: -6px;
  border-radius: 28px;
  pointer-events: none;
  z-index: 0;
  filter: blur(10px);
  animation: adv-glow-breathe 2.8s ease-in-out infinite;
}
.adv-card-fx-clip {
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  padding: 4px;
}
.adv-card-fx.is-wide .adv-card-fx-glow {
  inset: -14px;
  filter: blur(12px);
  border-radius: 32px;
}
.adv-card-fx.is-wide .adv-card-fx-clip {
  inset: -9px;
  padding: 10px;
  border-radius: 28px;
}
.adv-card-fx-conic {
  position: absolute;
  inset: -55%;
  animation: adv-spin 8s linear infinite;
  will-change: transform;
}
.adv-card-fx--aurora .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(232,195,106,0.18), transparent 70%);
}
.adv-card-fx--aurora .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 35%, #e8c36a, #fff1c2, #e8c36a, transparent 65%);
}
.adv-card-fx--neon_grid .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(57,243,255,0.16), rgba(255,77,219,0.08) 50%, transparent 72%);
}
.adv-card-fx--neon_grid .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 30%, #39f3ff, #fff, #39f3ff, transparent 50%, #ff4ddb, transparent 72%);
}
.adv-card-fx--void_runes .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(255,90,20,0.16), rgba(124,58,237,0.1) 55%, transparent 72%);
}
.adv-card-fx--void_runes .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 28%, #ff4d00, #ffd27a, #ff4d00, transparent 48%, #7c3aed, #ff6a00, transparent 78%);
}

.adv-card-fx--sakura_mist .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(244,114,182,0.4), transparent 70%);
}
.adv-card-fx--sakura_mist .adv-card-fx-conic {
  animation-duration: 12s;
  background: conic-gradient(from 0deg, transparent 0 32%, #f9a8d4, #fff, #f472b6, transparent 62%);
}

.adv-card-fx--storm_veil .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(96,165,250,0.38), transparent 70%);
  animation-duration: 1.6s;
}
.adv-card-fx--storm_veil .adv-card-fx-conic {
  animation-duration: 3s;
  background: conic-gradient(from 0deg, transparent 0 50%, #dbeafe, #60a5fa, transparent 72%);
}

.adv-card-fx--blood_haze .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(225,29,72,0.42), transparent 72%);
}
.adv-card-fx--blood_haze .adv-card-fx-conic {
  animation-duration: 7s;
  background: conic-gradient(from 0deg, transparent 0 30%, #e11d48, #fda4af, #881337, transparent 68%);
}

.adv-card-fx--prism_shift .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(196,181,253,0.4), rgba(56,189,248,0.18) 50%, transparent 72%);
}
.adv-card-fx--prism_shift .adv-card-fx-conic {
  animation: adv-spin 6s linear infinite, adv-hue 9s linear infinite;
  background: conic-gradient(from 0deg, #f472b6, #60a5fa, #34d399, #facc15, #c084fc, #f472b6);
}

.adv-card-fx--pixel_rain .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(74,222,128,0.32), transparent 70%);
}
.adv-card-fx--pixel_rain .adv-card-fx-conic {
  animation: adv-spin 5s steps(10, end) infinite;
  background: conic-gradient(from 0deg, transparent 0 40%, #4ade80, #ecfccb, #4ade80, transparent 70%);
}

.adv-card-fx--forest_glow .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(163,230,53,0.38), transparent 70%);
}
.adv-card-fx--forest_glow .adv-card-fx-conic {
  animation-duration: 14s;
  background: conic-gradient(from 0deg, transparent 0 34%, #a3e635, #ecfccb, #65a30d, transparent 66%);
}

.adv-card-fx--tide_caustic .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%);
}
.adv-card-fx--tide_caustic .adv-card-fx-conic {
  animation-duration: 9s;
  background: conic-gradient(from 0deg, transparent 0 28%, #22d3ee, #e0f2fe, #0891b2, transparent 62%);
}

.adv-card-fx--ghost_fog .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(226,232,240,0.35), transparent 72%);
}
.adv-card-fx--ghost_fog .adv-card-fx-conic {
  animation-duration: 16s;
  background: conic-gradient(from 0deg, transparent 0 38%, #f8fafc, #cbd5e1, transparent 68%);
}

.adv-card-fx--magma_flow .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(251,146,60,0.42), rgba(185,28,28,0.18) 55%, transparent 72%);
}
.adv-card-fx--magma_flow .adv-card-fx-conic {
  animation-duration: 6s;
  background: conic-gradient(from 0deg, transparent 0 26%, #fb923c, #facc15, #ea580c, transparent 52%, #7c2d12, transparent 78%);
}

.adv-card-fx--star_field .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(253,230,138,0.38), transparent 70%);
}
.adv-card-fx--star_field .adv-card-fx-conic {
  animation-duration: 18s;
  background: conic-gradient(from 0deg, transparent 0 40%, #fde68a, #fff, #fbbf24, transparent 70%);
}

.adv-card-fx--oak_shield {
  box-shadow: none;
}
.adv-card-fx--oak_shield::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 3;
  box-shadow:
    inset 0 0 0 1px rgba(28, 12, 4, 0.88),
    inset 0 0 0 2.5px rgba(232, 195, 106, 0.95);
}
.adv-card-fx--oak_shield .adv-card-fx-glow {
  inset: -12px;
  background:
    radial-gradient(circle at 50% 0%, rgba(232, 195, 106, 0.28), transparent 48%),
    radial-gradient(circle at 50% 100%, rgba(196, 122, 58, 0.32), transparent 64%);
  filter: blur(14px);
  animation: none;
  opacity: 0.95;
}
.adv-card-fx--oak_shield .adv-card-fx-clip {
  z-index: 2;
  inset: -5px;
  padding: 8px;
  outline: 1px solid #e8c36a;
  outline-offset: 0;
}
.adv-card-fx--oak_shield .adv-card-fx-conic {
  animation: none;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 228, 170, 0.55) 0 14%, transparent 38%, rgba(42, 18, 6, 0.42) 100%),
    repeating-linear-gradient(
      90deg,
      rgba(42, 18, 6, 0) 0 20px,
      rgba(42, 18, 6, 0.22) 20px 21px,
      rgba(255, 220, 150, 0.18) 21px 22px,
      rgba(42, 18, 6, 0) 23px 38px
    ),
    linear-gradient(
      90deg,
      #5c3010 0%,
      #8b4a1c 18%,
      #c47a3a 40%,
      #e0a05a 50%,
      #c47a3a 62%,
      #8b4a1c 82%,
      #5c3010 100%
    );
}
.adv-card-fx--oak_shield.is-wide .adv-card-fx-glow {
  inset: -16px;
}
.adv-card-fx--oak_shield.is-wide .adv-card-fx-clip {
  inset: -6px;
  padding: 9px;
}

:root[data-theme="light"] .adv-card-fx-glow {
  filter: blur(14px);
  animation-name: adv-glow-breathe-light;
}
:root[data-theme="light"] .adv-card-fx--aurora {
  box-shadow: 0 0 0 2px rgba(180,130,20,0.55), 0 8px 22px rgba(201,146,20,0.18);
}
:root[data-theme="light"] .adv-card-fx--aurora .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(201,146,20,0.5), transparent 70%);
}
:root[data-theme="light"] .adv-card-fx--aurora .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 28%, #c99214, #f5d56a, #c99214, transparent 62%);
}
:root[data-theme="light"] .adv-card-fx--neon_grid {
  box-shadow: 0 0 0 2px rgba(8,145,178,0.5), 0 8px 22px rgba(8,145,178,0.16);
}
:root[data-theme="light"] .adv-card-fx--neon_grid .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(8,145,178,0.42), rgba(219,39,119,0.18) 50%, transparent 72%);
}
:root[data-theme="light"] .adv-card-fx--neon_grid .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 24%, #0891b2, #67e8f9, #0891b2, transparent 48%, #db2777, transparent 70%);
}
:root[data-theme="light"] .adv-card-fx--void_runes {
  box-shadow: 0 0 0 2px rgba(194,65,12,0.5), 0 8px 22px rgba(124,58,237,0.14);
}
:root[data-theme="light"] .adv-card-fx--void_runes .adv-card-fx-glow {
  background: radial-gradient(circle, rgba(194,65,12,0.46), rgba(109,40,217,0.22) 55%, transparent 72%);
}
:root[data-theme="light"] .adv-card-fx--void_runes .adv-card-fx-conic {
  background: conic-gradient(from 0deg, transparent 0 22%, #c2410c, #fb923c, #c2410c, transparent 46%, #6d28d9, #ea580c, transparent 76%);
}
:root[data-theme="light"] .adv-card-fx--sakura_mist {
  box-shadow: 0 0 0 2px rgba(190,24,93,0.45), 0 8px 22px rgba(244,114,182,0.16);
}
:root[data-theme="light"] .adv-card-fx--storm_veil {
  box-shadow: 0 0 0 2px rgba(29,78,216,0.45), 0 8px 22px rgba(37,99,235,0.14);
}
:root[data-theme="light"] .adv-card-fx--blood_haze {
  box-shadow: 0 0 0 2px rgba(159,18,57,0.5), 0 8px 22px rgba(225,29,72,0.14);
}
:root[data-theme="light"] .adv-card-fx--prism_shift {
  box-shadow: 0 0 0 2px rgba(124,58,237,0.4), 0 8px 22px rgba(56,189,248,0.12);
}
:root[data-theme="light"] .adv-card-fx--pixel_rain {
  box-shadow: 0 0 0 2px rgba(21,128,61,0.48), 0 8px 22px rgba(22,163,74,0.14);
}
:root[data-theme="light"] .adv-card-fx--forest_glow {
  box-shadow: 0 0 0 2px rgba(101,163,13,0.5), 0 8px 22px rgba(163,230,53,0.16);
}
:root[data-theme="light"] .adv-card-fx--tide_caustic {
  box-shadow: 0 0 0 2px rgba(14,116,144,0.48), 0 8px 22px rgba(6,182,212,0.14);
}
:root[data-theme="light"] .adv-card-fx--ghost_fog {
  box-shadow: 0 0 0 2px rgba(100,116,139,0.45), 0 8px 22px rgba(148,163,184,0.14);
}
:root[data-theme="light"] .adv-card-fx--magma_flow {
  box-shadow: 0 0 0 2px rgba(194,65,12,0.5), 0 8px 22px rgba(234,88,12,0.16);
}
:root[data-theme="light"] .adv-card-fx--star_field {
  box-shadow: 0 0 0 2px rgba(180,83,9,0.48), 0 8px 22px rgba(251,191,36,0.16);
}
:root[data-theme="light"] .adv-card-fx--oak_shield {
  box-shadow: none;
}
:root[data-theme="light"] .adv-card-fx--oak_shield .adv-card-fx-glow {
  background:
    radial-gradient(circle at 50% 0%, rgba(201, 162, 39, 0.28), transparent 46%),
    radial-gradient(circle at 50% 100%, rgba(107, 48, 16, 0.28), transparent 62%);
}

.adv-crit-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.adv-crit-core {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  animation: adv-crit-burst 1.1s ease-out forwards;
}
.adv-crit-ring {
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 2px solid currentColor;
  animation: adv-crit-ring 1s ease-out forwards;
}

@keyframes adv-tip-in-below {
  from { opacity: 0; transform: translate(-50%, 8px) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
@keyframes adv-tip-in-above {
  from { opacity: 0; transform: translate(-50%, calc(-100% + 8px)) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
}
@keyframes adv-tip-out-below {
  from { opacity: 1; transform: translate(-50%, 0) scale(1); }
  to { opacity: 0; transform: translate(-50%, 6px) scale(0.98); }
}
@keyframes adv-tip-out-above {
  from { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  to { opacity: 0; transform: translate(-50%, calc(-100% + 6px)) scale(0.98); }
}

.adv-tip {
  position: fixed;
  z-index: 100000;
  width: 236px;
  padding: 11px 13px 12px;
  border-radius: 14px;
  pointer-events: none;
  color: #fff;
  font-family: inherit;
  background: rgba(14, 16, 26, 0.94);
  border: 1px solid color-mix(in srgb, var(--accent) 48%, rgba(255,255,255,0.14));
  box-shadow:
    0 18px 40px rgba(6, 8, 16, 0.42),
    0 0 22px color-mix(in srgb, var(--glow) 42%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transform-origin: 50% 0%;
  animation: adv-tip-in-below 180ms cubic-bezier(.22, 1, .36, 1) both;
}
.adv-tip.is-above {
  transform-origin: 50% 100%;
  animation-name: adv-tip-in-above;
}
.adv-tip.is-out {
  animation: adv-tip-out-below 140ms ease-in both;
}
.adv-tip.is-above.is-out {
  animation-name: adv-tip-out-above;
}
.adv-tip-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--accent);
  margin-bottom: 4px;
}
.adv-tip-body {
  display: block;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255,255,255,0.78);
}
.adv-tip-caret {
  position: absolute;
  left: var(--caret-x, 50%);
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  background: rgba(14, 16, 26, 0.94);
  transform: rotate(45deg);
}
.adv-tip.is-below .adv-tip-caret {
  top: -5px;
  border-left: 1px solid color-mix(in srgb, var(--accent) 48%, rgba(255,255,255,0.14));
  border-top: 1px solid color-mix(in srgb, var(--accent) 48%, rgba(255,255,255,0.14));
}
.adv-tip.is-above .adv-tip-caret {
  bottom: -5px;
  border-right: 1px solid color-mix(in srgb, var(--accent) 48%, rgba(255,255,255,0.14));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 48%, rgba(255,255,255,0.14));
}
`

export function ensureRewardsFxStyles() {
  if (typeof document === 'undefined') {
    return;
  }
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== CSS) {
    style.textContent = CSS;
  }
}

const FX_CLASS_ATTR = 'data-adv-fx';

type ClassHost = {
  classList?: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
  };
  getAttribute?: (name: string) => string | null;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

/** Apply FX classes by replace, not add — RN Web reuses the node when the frame/aura changes. */
export function webFxClass(className: string) {
  const next = className.split(/\s+/).filter(Boolean);
  return {
    ref: (node: unknown) => {
      const el = node as ClassHost | null;
      if (!el?.classList) {
        return;
      }
      const prev = (el.getAttribute?.(FX_CLASS_ATTR) ?? '').split(/\s+/).filter(Boolean);
      if (prev.length) {
        el.classList.remove(...prev);
      }
      if (next.length) {
        el.classList.add(...next);
        el.setAttribute?.(FX_CLASS_ATTR, next.join(' '));
      } else {
        el.removeAttribute?.(FX_CLASS_ATTR);
      }
    },
  };
}

// Lumière Vivante (spec v2 §2, §3.1, §3.2) : scènes, interpolation de
// session et fond vivant canvas. Le canvas est un embellissement,
// jamais une dépendance : repli sur le dégradé CSS statique.

export const SCENES = ['dawn', 'day', 'evening', 'night'];

// Scène pilotée par l'horloge locale. La scène Nuit n'est JAMAIS
// choisie par l'horloge, uniquement par le mode chevet (F1).
export function sceneForHour(h) {
  if (h < 8) return 'dawn';
  if (h < 18) return 'day';
  return 'evening';
}

// La scène Nuit n'est jamais choisie ici, quels que soient les réglages :
// c'est un invariant de source, pas seulement une absence d'option dans
// l'interface. Un settings.scene = 'night' corrompu ou importé retombe sur
// l'horloge plutôt que de verrouiller l'app en quasi-noir hors chevet.
const CLOCK_SCENES = ['dawn', 'day', 'evening'];

export function resolveScene(settings, hour) {
  const pref = settings?.scene || 'auto';
  if (pref !== 'auto' && CLOCK_SCENES.includes(pref)) return pref;
  return sceneForHour(hour);
}

export function applyScene(name) {
  document.documentElement.dataset.scene = SCENES.includes(name) ? name : 'dawn';
}

export function currentScene() {
  return document.documentElement.dataset.scene || 'dawn';
}

// Position d'avancement -> lumière de scène. tempo : -1 (serré, plus pâle
// et froide) à +1 (en avance, plus dorée). Jamais de rouge, jamais d'alerte.
export function sessionLight(progress, tempo = 0) {
  const l = 0.08 + Math.min(Math.max(progress, 0), 1) * 0.92;
  const warm = 0.5 + Math.min(Math.max(tempo, -1), 1) * 0.35;
  return { l, warm };
}

export function setLight(l, warm = 0.5) {
  const root = document.documentElement;
  root.style.setProperty('--scene-l', String(Math.min(Math.max(l, 0), 1)));
  root.style.setProperty('--scene-warm', String(Math.min(Math.max(warm, 0), 1)));
  ambientLightChanged();
}

export function resetLight() {
  document.documentElement.style.removeProperty('--scene-l');
  document.documentElement.style.removeProperty('--scene-warm');
  ambientLightChanged();
}

// ─── Fond vivant (canvas ambiant) ───────────────────────────────

// Teintes de base de la lueur par scène [r, g, b].
const GLOW = {
  dawn:    [232, 180, 80],
  day:     [212, 168, 96],
  evening: [217, 132, 70],
  night:   [58, 36, 16],
};

let cv = null, ctx2d = null, grain = null, particles = [], rafId = 0;
let lastFrame = 0, disabled = false, listeners = [];

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readLight() {
  const s = getComputedStyle(document.documentElement);
  return {
    l: parseFloat(s.getPropertyValue('--scene-l')) || 0,
    warm: parseFloat(s.getPropertyValue('--scene-warm')) || 0.5,
  };
}

function makeGrain() {
  const g = document.createElement('canvas');
  g.width = g.height = 128;
  const gx = g.getContext('2d');
  const img = gx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14; // grain très discret
  }
  gx.putImageData(img, 0, 0);
  return g;
}

function resize() {
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
}

function drawFrame(now) {
  const { l, warm } = readLight();
  const [r, g, b] = GLOW[currentScene()] || GLOW.dawn;
  const w = cv.width, h = cv.height;
  ctx2d.clearRect(0, 0, w, h);

  // Lumière montant du bas, intensité pilotée par --scene-l.
  const grad = ctx2d.createRadialGradient(w / 2, h * 1.15, h * 0.1, w / 2, h * 1.15, h * 1.2);
  const alpha = 0.04 + l * 0.22;
  const rr = Math.round(r * (0.85 + warm * 0.3));
  grad.addColorStop(0, `rgba(${rr},${g},${b},${alpha.toFixed(3)})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, w, h);

  // Particules de lumière (2 à 3, opacité max 0.15).
  for (const p of particles) {
    const y = (p.y - (now * p.speed) % 1.4 + 1.4) % 1.4 - 0.2;
    const tw = 0.5 + 0.5 * Math.sin(now / 2300 + p.phase);
    ctx2d.beginPath();
    ctx2d.arc(p.x * w, y * h, p.r, 0, Math.PI * 2);
    ctx2d.fillStyle = `rgba(${r},${g},${b},${(0.05 + tw * 0.1 * l).toFixed(3)})`;
    ctx2d.fill();
  }

  // Grain photographique pré-généré, jamais recalculé.
  ctx2d.globalAlpha = 0.5;
  ctx2d.drawImage(grain, 0, 0, w, h);
  ctx2d.globalAlpha = 1;
}

function loop(now) {
  if (disabled) return;
  rafId = requestAnimationFrame(loop);
  if (now - lastFrame < 83) return; // 12 fps max
  lastFrame = now;
  drawFrame(now);
}

export function startCanvas() {
  if (disabled || cv) return;
  cv = document.getElementById('scene-canvas');
  if (!cv) return;
  ctx2d = cv.getContext('2d');
  if (!ctx2d) { disabled = true; return; }
  grain = makeGrain();
  particles = Array.from({ length: 3 }, () => ({
    x: 0.15 + Math.random() * 0.7,
    y: Math.random() * 1.2,
    r: 2 + Math.random() * 2,
    speed: 0.000008 + Math.random() * 0.000008,
    phase: Math.random() * 6.28,
  }));
  resize();

  // Repli : premier frame trop lent -> dégradé CSS statique seulement.
  const t0 = performance.now();
  drawFrame(t0);
  if (performance.now() - t0 > 20) {
    disabled = true;
    cv.remove();
    cv = null;
    return;
  }

  if (reducedMotion()) return; // un frame statique suffit

  const onResize = () => { resize(); drawFrame(performance.now()); };
  const onVis = () => {
    cancelAnimationFrame(rafId);
    if (!document.hidden && !reducedMotion()) rafId = requestAnimationFrame(loop);
  };
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  listeners = [['resize', onResize, window], ['visibilitychange', onVis, document]];
  rafId = requestAnimationFrame(loop);
}

// Un changement de lumière force un frame même entre deux ticks.
function ambientLightChanged() {
  if (cv && ctx2d && (document.hidden === false)) drawFrame(performance.now());
}


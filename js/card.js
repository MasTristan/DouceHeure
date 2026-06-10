// Carte du matin (spec v2 §11) : génération locale canvas 1080x1920,
// export PNG, partage Web Share niveau 2 avec repli téléchargement.
// Jamais de chiffre, de durée ni de score (R1, R5).
// Zéro donnée sortante autre que l'image que l'utilisateur choisit d'envoyer.

const W = 1080, H = 1920;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function dateInWords(d = new Date()) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const PHRASES = {
  early: 'Parti(e) en avance, sans courir',
  ontime: 'Parti(e) à l\'heure, sans courir',
  late: 'Parti(e) ce matin, à son rythme',
};

// session : { steps: [{label, confirmed}], status, name, light }
export function drawCard(session) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');

  // La scène de lumière figée à son état final.
  const l = Math.min(Math.max(session.light ?? 1, 0), 1);
  c.fillStyle = '#0f0d0b';
  c.fillRect(0, 0, W, H);
  const grad = c.createRadialGradient(W / 2, H * 1.05, H * 0.1, W / 2, H * 1.05, H * 1.15);
  grad.addColorStop(0, `rgba(232, 180, 80, ${(0.10 + l * 0.30).toFixed(3)})`);
  grad.addColorStop(0.6, `rgba(190, 130, 60, ${(0.04 + l * 0.10).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);

  // La constellation des étapes confirmées : points de lumière reliés.
  const confirmed = (session.steps || []).filter((s) => s.confirmed);
  const cx = W / 2, baseY = H * 0.30, span = H * 0.34;
  const pts = confirmed.map((s, i) => {
    const t = confirmed.length > 1 ? i / (confirmed.length - 1) : 0.5;
    // Légère sinuosité, déterministe par index.
    const x = cx + Math.sin(i * 2.1 + 0.8) * W * 0.16;
    return { x, y: baseY + t * span, label: s.label };
  });

  c.strokeStyle = 'rgba(232, 200, 122, 0.22)';
  c.lineWidth = 3;
  c.beginPath();
  pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
  if (pts.length > 1) c.stroke();

  for (const p of pts) {
    const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 36);
    glow.addColorStop(0, 'rgba(232, 200, 122, 0.85)');
    glow.addColorStop(1, 'rgba(232, 200, 122, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(p.x, p.y, 36, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f2ead8';
    c.beginPath();
    c.arc(p.x, p.y, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(242, 234, 216, 0.66)';
    c.font = '400 34px Outfit, sans-serif';
    c.textAlign = 'left';
    c.fillText(p.label, p.x + 56, p.y + 12);
  }

  // Texte : prénom, phrase selon statut, date en toutes lettres.
  c.textAlign = 'center';
  c.fillStyle = '#f2ead8';
  c.font = 'italic 400 92px Fraunces, serif';
  const title = session.name ? `${session.name}.` : 'Douce heure';
  c.fillText(title, cx, H * 0.13);

  c.fillStyle = '#e8c87a';
  c.font = 'italic 400 56px Fraunces, serif';
  c.fillText(PHRASES[session.status] || PHRASES.ontime, cx, H * 0.76);

  c.fillStyle = 'rgba(160, 144, 112, 0.9)';
  c.font = '400 40px Outfit, sans-serif';
  c.fillText(dateInWords(session.date ? new Date(session.date) : new Date()), cx, H * 0.82);

  // Signature discrète.
  c.fillStyle = 'rgba(160, 144, 112, 0.55)';
  c.font = 'italic 400 36px Fraunces, serif';
  c.fillText('Douce heure', cx, H * 0.93);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Partage via Web Share API niveau 2 (fichiers) ; repli : téléchargement.
// Renvoie 'shared' | 'downloaded' | 'cancelled'.
export async function shareCard(canvas) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return 'cancelled';
  const file = new File([blob], 'douce-heure.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch {
      return 'cancelled'; // l'utilisateur a refermé la feuille de partage
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'douce-heure.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

// J1 découpe étape 6 (Milo, S1) · Ce que l'app a appris, en données pures :
// aucune dépendance au DOM ni à copy.js, testable sans navigateur
// (CLAUDE.md §4, séparation stricte calcul / rendu). Le rendu
// (screens/mornings.js) transforme ces données en phrases affichées.
// N'expose jamais la marge de sécurité ni un tableau brut de durées (R4).

// Étapes mesurées au moins 3 fois, avec le jour où elles prennent
// significativement plus de temps que la moyenne (>= 2 min, sur au moins
// deux mesures ce jour-là), le cas échéant.
export function learnedSteps(state) {
  const out = [];
  for (const profile of state.profiles) {
    for (const step of profile.steps) {
      if ((step.real || []).length < 3) continue;
      const byDay = {};
      for (const r of step.real) (byDay[r.day] = byDay[r.day] || []).push(r.v);
      const overall = step.real.reduce((a, r) => a + r.v, 0) / step.real.length;
      let slowDay = null;
      for (const [day, vals] of Object.entries(byDay)) {
        if (vals.length >= 2 && vals.reduce((a, b) => a + b, 0) / vals.length > overall + 2) {
          slowDay = Number(day);
        }
      }
      out.push({ label: step.label, slowDay });
    }
  }
  return out;
}

// Trajets (destination x transport) mesurés au moins 3 fois.
export function learnedTravels(state) {
  const out = [];
  for (const dest of state.destinations) {
    for (const [transport, entry] of Object.entries(dest.byTransport || {})) {
      if ((entry.real || []).length >= 3) {
        out.push({ transport, destinationLabel: dest.label });
      }
    }
  }
  return out;
}

// F5 · Apprentissage du trajet réel : destinations et pendingTrip.
// R3 appliqué au trajet : seules les durées mesurées entre "Je pars" et
// "Je suis arrivé" sont écrites, bornées à [5, 180] minutes.
// Fonctions pures sur l'état, aucun DOM.

export const TRIP_MIN_MINUTES = 5;
export const TRIP_MAX_MINUTES = 180;
export const TRIP_PURGE_MINUTES = 240; // pendingTrip purgé après 4h
export const MAX_TRAVEL_REAL = 8;      // FIFO

export function addDestination(state, label) {
  const dest = {
    id: `dest_${Date.now().toString(36)}_${state.destinations.length}`,
    label: String(label).trim().slice(0, 40),
    byTransport: {},
  };
  state.destinations.push(dest);
  return dest;
}

export function getDestination(state, id) {
  return state.destinations?.find((d) => d.id === id) || null;
}

export function removeDestination(state, id) {
  state.destinations = (state.destinations || []).filter((d) => d.id !== id);
  for (const p of state.profiles || []) {
    if (p.defaults?.destinationId === id) p.defaults.destinationId = null;
  }
}

// "Je pars" : ouvre un trajet en attente, persisté dans l'état.
export function startTrip(state, destinationId, transport, now = Date.now()) {
  state.pendingTrip = { leaveTs: now, destinationId: destinationId || null, transport };
}

// Statut d'un trajet en attente.
// 'none' : pas de trajet · 'open' : confirmable · 'short' : trop tôt pour
// être une mesure valide · 'expired' : au-delà de la purge.
export function tripStatus(pendingTrip, now = Date.now()) {
  if (!pendingTrip) return { status: 'none', minutes: 0 };
  const minutes = (now - pendingTrip.leaveTs) / 60000;
  if (minutes > TRIP_PURGE_MINUTES) return { status: 'expired', minutes };
  if (minutes < TRIP_MIN_MINUTES) return { status: 'short', minutes };
  return { status: 'open', minutes };
}

// "Je suis arrivé" : écrit la mesure si et seulement si elle est dans les
// bornes [5, 180] minutes. Hors bornes : rejet silencieux, aucune écriture.
// Le pendingTrip est consommé dans tous les cas.
export function confirmArrival(state, now = Date.now()) {
  const trip = state.pendingTrip;
  if (!trip) return false;
  state.pendingTrip = null;

  const minutes = Math.round((now - trip.leaveTs) / 60000);
  if (minutes < TRIP_MIN_MINUTES || minutes > TRIP_MAX_MINUTES) return false;

  const dest = getDestination(state, trip.destinationId);
  if (!dest) return false;

  if (!dest.byTransport[trip.transport]) {
    dest.byTransport[trip.transport] = { real: [] };
  }
  const real = dest.byTransport[trip.transport].real;
  real.push({ v: minutes, day: new Date(now).getDay() });
  if (real.length > MAX_TRAVEL_REAL) real.shift(); // FIFO
  return true;
}

// Purge silencieuse d'un trajet périmé (appelée au démarrage).
export function purgeExpiredTrip(state, now = Date.now()) {
  if (state.pendingTrip && tripStatus(state.pendingTrip, now).status === 'expired') {
    state.pendingTrip = null;
    return true;
  }
  return false;
}

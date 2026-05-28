// Orchestration. Étape 1 : enregistre le Service Worker pour le cache hors-ligne.
// Les écrans et la logique métier arrivent aux étapes suivantes.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // hors-ligne ou contexte non sécurisé : on ignore silencieusement.
    });
  });
}

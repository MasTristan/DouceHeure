// J1 découpe étape 3 (Nour, R1 §1.3) · Registre de navigation, pas un bus.
// Les écrans s'appellent en croix (home → preview → live → trip →
// feedback → card → mornings → home ; settings → social → settings ;
// goodmorning → preview ; studio → home). Dans un seul fichier, ça ne se
// voit pas. Découpé en modules, ça donne un cycle d'imports statiques.
//
// Ce que ce module N'est PAS : ni un bus d'événements, ni un système
// d'abonnement. Une table de fonctions, remplie une fois au démarrage par
// app.js, statiquement lisible, dont on peut lister les clés dans un test.
// Zéro ordre implicite : chaque appelant sait exactement quelle fonction il
// invoque, seule son adresse est indirecte.
export const nav = {};

export function registerScreens(map) {
  Object.assign(nav, map);
}

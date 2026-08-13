// J1 découpe étape 3 (Nour, R1 §1.3) · Aucun cycle d'imports statiques
// dans js/. Un seul cycle existait avant cette étape (studio.js <-> ui.js,
// contourné par un import() dynamique reporté au tap de l'utilisateur) ;
// ui/nav.js le remplace par une table de fonctions. Ce test garantit qu'un
// futur cycle ne se réintroduit pas pendant la suite de la découpe
// (étapes 4 à 7 ajoutent une vingtaine de fichiers).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS_ROOT = path.join(__dirname, '..', 'js');

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Extrait les specifiers d'import STATIQUES uniquement (import ... from
// '...'). Les import() dynamiques ne participent pas au graphe statique et
// sont volontairement ignorés : ce test porte sur les cycles de
// chargement de module, pas sur tous les couplages possibles.
function staticImportSpecifiers(source) {
  const specs = [];
  const re = /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

function buildGraph() {
  const files = listJsFiles(JS_ROOT);
  const graph = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const specs = staticImportSpecifiers(source)
      .filter((s) => s.startsWith('.'))
      .map((s) => path.normalize(path.join(path.dirname(file), s)));
    graph.set(file, specs);
  }
  return graph;
}

// Détection de cycle par parcours en profondeur, pile de récursion
// classique (blanc/gris/noir).
function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...graph.keys()].map((f) => [f, WHITE]));
  const stack = [];

  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      if (!graph.has(dep)) continue; // hors js/ (ex. imports vers assets, tests)
      if (color.get(dep) === GRAY) {
        return [...stack.slice(stack.indexOf(dep)), dep];
      }
      if (color.get(dep) === WHITE) {
        const cycle = visit(dep);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

test('aucun cycle d\'imports statiques dans js/', () => {
  const graph = buildGraph();
  assert.ok(graph.size > 10, 'le graphe semble trop petit, le parcours de js/ a probablement echoue');
  const cycle = findCycle(graph);
  const readable = cycle ? cycle.map((f) => path.relative(JS_ROOT, f)).join(' -> ') : null;
  assert.equal(cycle, null, `cycle d'imports detecte : ${readable}`);
});

test('ui/nav.js n\'est jamais importe dynamiquement (import() sur ui.js) ailleurs dans js/', () => {
  const files = listJsFiles(JS_ROOT);
  for (const file of files) {
    // Commentaires exclus : ce test cherche du code, pas de la prose qui
    // mentionne l'ancien contournement (voir app.js, qui l'explique).
    const source = fs.readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    assert.doesNotMatch(
      source, /import\(['"]\.\/ui\.js['"]\)/,
      `${path.relative(JS_ROOT, file)} contourne encore le cycle par un import() dynamique de ui.js`
    );
  }
});

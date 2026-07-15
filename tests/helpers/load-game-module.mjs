import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJs(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function prepareSource(source) {
  // Top-level const bindings are not visible on the vm context; use var instead.
  return source.replace(/^const ([A-Za-z_$][\w$]*)\s*=/gm, 'var $1 =');
}

/**
 * Load one or more classic game scripts into a shared vm context.
 * @param {string|string[]} sources - path(s) relative to project root, e.g. 'js/save.js'
 * @param {object} stubs - injected globals before scripts run
 * @returns {vm.Context}
 */
export function loadGameModule(sources, stubs = {}) {
  const files = Array.isArray(sources) ? sources : [sources];
  const context = { console, ...stubs };
  vm.createContext(context);
  for (const file of files) {
    const source = prepareSource(readJs(file));
    vm.runInContext(source, context);
  }
  return context;
}

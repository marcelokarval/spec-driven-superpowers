const STORAGE_KEY = 'synthetic-orders:saved-views';
const FORMAT_VERSION = 1;

function defaultIdGenerator() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Este ambiente não oferece crypto.randomUUID().');
  }

  return globalThis.crypto.randomUUID();
}

function readViews(storage) {
  const serialized = storage.getItem(STORAGE_KEY);
  if (serialized === null) return [];

  let document;
  try {
    document = JSON.parse(serialized);
  } catch {
    throw new Error('O JSON das visões salvas está inválido.');
  }

  if (
    document === null ||
    typeof document !== 'object' ||
    document.version !== FORMAT_VERSION ||
    !Array.isArray(document.views)
  ) {
    throw new Error('O formato das visões salvas não é compatível.');
  }

  const ids = new Set();
  for (const view of document.views) {
    if (
      view === null ||
      typeof view !== 'object' ||
      typeof view.id !== 'string' ||
      view.id.length === 0 ||
      typeof view.name !== 'string' ||
      view.name.trim().length === 0 ||
      typeof view.status !== 'string'
    ) {
      throw new Error('O JSON contém uma visão salva inválida.');
    }
    if (ids.has(view.id)) {
      throw new Error('O JSON contém IDs de visão duplicados.');
    }
    ids.add(view.id);
  }

  return document.views.map(view => ({
    id: view.id,
    name: view.name,
    status: view.status,
  }));
}

function writeViews(storage, views) {
  storage.setItem(STORAGE_KEY, JSON.stringify({
    version: FORMAT_VERSION,
    views,
  }));
}

export function createSavedViews({ storage, createId = defaultIdGenerator } = {}) {
  const localStorage = storage ?? globalThis.localStorage;
  if (
    !localStorage ||
    typeof localStorage.getItem !== 'function' ||
    typeof localStorage.setItem !== 'function'
  ) {
    throw new Error('É necessário fornecer um armazenamento compatível com localStorage.');
  }

  return {
    save(name, status) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new TypeError('O nome da visão é obrigatório.');
      }
      if (typeof status !== 'string') {
        throw new TypeError('O status do filtro deve ser uma string.');
      }

      const views = readViews(localStorage);
      const id = createId();
      if (typeof id !== 'string' || id.length === 0) {
        throw new TypeError('O gerador deve fornecer um ID não vazio.');
      }
      if (views.some(view => view.id === id)) {
        throw new Error('O gerador produziu um ID de visão duplicado.');
      }

      const view = { id, name: name.trim(), status };
      writeViews(localStorage, [...views, view]);
      return { ...view };
    },

    list() {
      return readViews(localStorage).map(view => ({ ...view }));
    },

    open(id) {
      const view = readViews(localStorage).find(item => item.id === id);
      return view ? { ...view } : null;
    },

    delete(id) {
      const views = readViews(localStorage);
      const remaining = views.filter(view => view.id !== id);
      if (remaining.length === views.length) return false;

      writeViews(localStorage, remaining);
      return true;
    },
  };
}

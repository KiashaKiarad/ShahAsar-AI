const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.resolve(
  process.env.LEGAL_RAG_WATCHES || path.join(__dirname, "../../data/legal-watches.json")
);

function load(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { version: 1, items: [] };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed.items) ? parsed : { version: 1, items: [] };
  } catch {
    return { version: 1, items: [] };
  }
}

function save(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function createLegalWatchStore(options = {}) {
  const filePath = options.filePath || DEFAULT_PATH;
  const state = load(filePath);

  function upsert(item) {
    if (!item || !item.id) throw new Error("WATCH_ITEM_ID_REQUIRED");
    const normalized = {
      id: String(item.id),
      ownerId: item.ownerId == null ? null : String(item.ownerId),
      kind: item.kind || "document",
      title: String(item.title || ""),
      text: String(item.text || ""),
      jurisdiction: String(item.jurisdiction || "IR").toUpperCase(),
      status: item.status || "active",
      metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
      updatedAt: new Date().toISOString()
    };

    const index = state.items.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...normalized };
    else state.items.push(normalized);
    save(filePath, state);
    return normalized;
  }

  function remove(id) {
    const before = state.items.length;
    state.items = state.items.filter((item) => item.id !== id);
    if (state.items.length !== before) save(filePath, state);
    return before !== state.items.length;
  }

  function list(filters = {}) {
    return state.items.filter((item) => {
      if (filters.ownerId != null && item.ownerId !== String(filters.ownerId)) return false;
      if (filters.kind && item.kind !== filters.kind) return false;
      if (filters.jurisdiction && item.jurisdiction !== String(filters.jurisdiction).toUpperCase()) return false;
      if (filters.status && item.status !== filters.status) return false;
      return true;
    });
  }

  return { upsert, remove, list };
}

module.exports = { DEFAULT_PATH, createLegalWatchStore };

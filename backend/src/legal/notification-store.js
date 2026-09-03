const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.resolve(
  process.env.LEGAL_RAG_NOTIFICATIONS || path.join(__dirname, "../../data/legal-notifications.json")
);

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed;
  } catch {
    return fallback;
  }
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, filePath);
}

function createNotificationStore(options = {}) {
  const filePath = options.filePath || DEFAULT_PATH;
  let state = readJson(filePath, { version: 1, notifications: [] });
  if (!Array.isArray(state.notifications)) state.notifications = [];

  function add(notification) {
    const record = {
      id: notification.id || cryptoRandomId(),
      createdAt: notification.createdAt || new Date().toISOString(),
      read: Boolean(notification.read),
      ...notification
    };
    state.notifications.unshift(record);
    state.notifications = state.notifications.slice(0, 5000);
    atomicWrite(filePath, state);
    return record;
  }

  function addMany(items) {
    let count = 0;
    for (const item of Array.isArray(items) ? items : []) {
      add(item);
      count += 1;
    }
    return count;
  }

  function list(filters = {}) {
    return state.notifications.filter((item) => {
      if (filters.ownerId && item.ownerId !== filters.ownerId) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.relatedItemId && item.relatedItemId !== filters.relatedItemId) return false;
      return true;
    });
  }

  function markRead(id) {
    const item = state.notifications.find((entry) => entry.id === id);
    if (!item) return false;
    item.read = true;
    item.readAt = new Date().toISOString();
    atomicWrite(filePath, state);
    return true;
  }

  return { add, addMany, list, markRead };
}

function cryptoRandomId() {
  return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { DEFAULT_PATH, createNotificationStore };

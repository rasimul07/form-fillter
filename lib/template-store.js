const STORAGE_KEY = 'formFillerTemplates';

function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aUsed = a.lastUsedAt || 0;
    const bUsed = b.lastUsedAt || 0;
    if (aUsed !== bUsed) return bUsed - aUsed;
    return (b.usageCount || 0) - (a.usageCount || 0);
  });
}

async function readAll() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function writeAll(templates) {
  await chrome.storage.local.set({ [STORAGE_KEY]: templates });
}

export async function getAll() {
  return sortTemplates(await readAll());
}

export async function getById(id) {
  const templates = await readAll();
  return templates.find((t) => t.id === id) || null;
}

export async function save(template) {
  const templates = await readAll();
  const now = Date.now();
  const existingIndex = templates.findIndex((t) => t.id === template.id);

  const record = {
    usageCount: 0,
    lastUsedAt: null,
    pinned: false,
    createdAt: now,
    ...template,
    id: template.id || crypto.randomUUID(),
  };

  if (existingIndex >= 0) {
    const existing = templates[existingIndex];
    record.usageCount = existing.usageCount;
    record.lastUsedAt = existing.lastUsedAt;
    record.pinned = template.pinned ?? existing.pinned;
    record.createdAt = existing.createdAt;
    templates[existingIndex] = record;
  } else {
    templates.push(record);
  }

  await writeAll(templates);
  return record;
}

export async function remove(id) {
  const templates = await readAll();
  await writeAll(templates.filter((t) => t.id !== id));
}

export async function togglePin(id) {
  const templates = await readAll();
  const template = templates.find((t) => t.id === id);
  if (!template) return null;

  template.pinned = !template.pinned;
  await writeAll(templates);
  return template;
}

export async function recordUsage(id) {
  const templates = await readAll();
  const template = templates.find((t) => t.id === id);
  if (!template) return null;

  template.usageCount = (template.usageCount || 0) + 1;
  template.lastUsedAt = Date.now();
  await writeAll(templates);
  return template;
}

export function getPinned(templates) {
  return templates.filter((t) => t.pinned);
}

export function getRecent(templates, limit = 5) {
  return [...templates]
    .filter((t) => t.lastUsedAt)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

export function searchTemplates(templates, query) {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.urlPattern || '').toLowerCase().includes(q) ||
      t.fields.some((f) => (f.label || '').toLowerCase().includes(q))
  );
}

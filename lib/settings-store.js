const STORAGE_KEY = 'formFillerSettings';

const DEFAULTS = {
  uiMode: 'sidePanel',
  allowDrag: false,
  genMode: 'faker',
  aimlApiKey: '',
};

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULTS, ...(result[STORAGE_KEY] || {}) };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

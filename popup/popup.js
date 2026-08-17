import { generateData } from '../lib/ai-generator.js';
import { generateDemoData } from '../lib/demo-generator.js';
import {
  getAll,
  save,
  remove,
  togglePin,
  recordUsage,
  getPinned,
  getRecent,
  searchTemplates,
} from '../lib/template-store.js';
import { getSettings, saveSettings } from '../lib/settings-store.js';
import { FIELD_TYPE_OPTIONS } from '../lib/field-types.js';

const state = {
  scannedFields: [],
  previewData: [],
  builderPreview: [],
  currentTabUrl: '',
  editingTemplateId: null,
  builderFields: [],
  minimized: false,
  genMode: 'faker',
  aimlApiKey: '',
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(action, payload = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab found');

  try {
    return await chrome.tabs.sendMessage(tab.id, { action, ...payload });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.bundle.js'],
    });
    return chrome.tabs.sendMessage(tab.id, { action, ...payload });
  }
}

function showStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = `status ${isError ? 'error' : 'success'}`;
  if (message) {
    setTimeout(() => {
      if (el.textContent === message) {
        el.textContent = '';
        el.className = 'status';
      }
    }, 3000);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function renderPreviewTable(containerId, data) {
  const container = document.getElementById(containerId);
  if (!data.length) {
    container.innerHTML = '<p class="empty">No fields to preview.</p>';
    return;
  }

  container.innerHTML = `
    <table class="preview-table">
      <thead>
        <tr><th>Field</th><th>Type</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${data
          .map(
            (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td><span class="type-badge">${escapeHtml(row.type)}</span></td>
            <td class="value-cell">${escapeHtml(String(row.value))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function resolveSelectValues(data) {
  const hasSelects = data.some(
    (f) => f.htmlType === 'select' || f.htmlType === 'custom-select'
  );
  if (!hasSelects) return data;
  const response = await sendToContent('resolveSelectValues', { fields: data });
  return response.fields || data;
}

async function regeneratePreview() {
  if (!state.scannedFields.length) return;

  const fields = state.scannedFields.map((f) => ({
    ...f,
    type: f.detectedType,
  }));

  try {
    if (state.genMode === 'ai') {
      showStatus('Generating with AI...');
    }

    const pageContext = await sendToContent('getPageContext');
    state.previewData = await generateData(fields, pageContext, state.genMode, {
      apiKey: state.aimlApiKey,
    });
    const resolved = await resolveSelectValues(state.previewData);
    state.previewData = resolved;
    renderPreviewTable('scan-preview', state.previewData);

    if (state.genMode === 'ai') {
      showStatus('AI data generated.');
    }
  } catch (err) {
    showStatus(err.message || 'Failed to generate preview.', true);
  }
}

async function handleScan() {
  showStatus('Scanning page...');
  try {
    const response = await sendToContent('scanFields');
    state.scannedFields = response.fields || [];
    if (!state.scannedFields.length) {
      showStatus('No form fields found on this page.', true);
      renderPreviewTable('scan-preview', []);
      return;
    }
    await regeneratePreview();
    showStatus(`Found ${state.scannedFields.length} field(s).`);
  } catch (err) {
    showStatus(err.message || 'Failed to scan page.', true);
  }
}

async function handleFill(data) {
  if (!data.length) {
    showStatus('Nothing to fill.', true);
    return;
  }
  try {
    const resolved = await resolveSelectValues(data);
    const response = await sendToContent('fillForm', { fields: resolved });
    const filled = (response.results || []).filter((r) => r.success).length;
    showStatus(`Filled ${filled} of ${data.length} field(s).`);
  } catch (err) {
    showStatus(err.message || 'Failed to fill form.', true);
  }
}

async function handleSaveScanTemplate() {
  const nameInput = document.getElementById('template-name');
  const name = nameInput.value.trim();
  if (!name) {
    showStatus('Enter a template name.', true);
    return;
  }
  if (!state.scannedFields.length) {
    showStatus('Scan a page first.', true);
    return;
  }

  const tab = await getActiveTab();
  await save({
    name,
    urlPattern: tab?.url || '',
    fields: state.scannedFields.map((f) => ({
      selector: f.selector,
      label: f.label,
      type: f.detectedType,
      htmlType: f.htmlType,
      fixedValue: null,
      options: f.options || null,
    })),
  });

  nameInput.value = '';
  showStatus('Template saved.');
  await renderTemplates();
}

function templateToFillData(template) {
  return generateDemoData(
    template.fields.map((f) => ({
      selector: f.selector,
      label: f.label,
      type: f.type,
      htmlType: f.htmlType,
      fixedValue: f.fixedValue,
    }))
  );
}

async function fillTemplate(template) {
  const data = await resolveSelectValues(templateToFillData(template));
  await handleFill(data);
  await recordUsage(template.id);
  await renderTemplates();
}

function renderTemplateRow(template) {
  return `
    <div class="template-row" data-id="${template.id}">
      <div class="template-info">
        <strong>${escapeHtml(template.name)}</strong>
        <span class="meta">${template.fields.length} field(s)</span>
      </div>
      <div class="template-actions">
        <button class="btn-icon pin-btn" title="${template.pinned ? 'Unpin' : 'Pin'}">${template.pinned ? '★' : '☆'}</button>
        <button class="btn small fill-btn">Fill</button>
        <button class="btn small secondary edit-btn">Edit</button>
        <button class="btn small danger delete-btn">Del</button>
      </div>
    </div>`;
}

async function renderTemplates() {
  const templates = await getAll();
  const query = document.getElementById('template-search')?.value || '';
  const filtered = searchTemplates(templates, query);

  document.getElementById('pinned-list').innerHTML =
    getPinned(filtered).map(renderTemplateRow).join('') ||
    '<p class="empty">No pinned templates.</p>';

  document.getElementById('recent-list').innerHTML =
    getRecent(filtered).map(renderTemplateRow).join('') ||
    '<p class="empty">No recent templates.</p>';

  document.getElementById('all-list').innerHTML =
    filtered.map(renderTemplateRow).join('') ||
    '<p class="empty">No templates saved yet.</p>';
}

function bindTemplateListEvents(container) {
  container.addEventListener('click', async (e) => {
    const row = e.target.closest('.template-row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.fill-btn')) {
      const templates = await getAll();
      const template = templates.find((t) => t.id === id);
      if (template) await fillTemplate(template);
    } else if (e.target.closest('.pin-btn')) {
      await togglePin(id);
      await renderTemplates();
    } else if (e.target.closest('.delete-btn')) {
      await remove(id);
      await renderTemplates();
      showStatus('Template deleted.');
    } else if (e.target.closest('.edit-btn')) {
      const templates = await getAll();
      const template = templates.find((t) => t.id === id);
      if (template) loadTemplateIntoBuilder(template);
    }
  });
}

function loadTemplateIntoBuilder(template) {
  state.editingTemplateId = template.id;
  state.builderFields = template.fields.map((f) => ({ ...f }));
  document.getElementById('builder-name').value = template.name;
  document.getElementById('builder-url').value = template.urlPattern || '';
  renderBuilderFields();
  switchTab('create');
  showStatus('Template loaded for editing.');
}

function renderBuilderFields() {
  const container = document.getElementById('builder-fields');
  if (!state.builderFields.length) {
    container.innerHTML = '<p class="empty">Add fields to build a template.</p>';
    return;
  }

  const typeOptions = FIELD_TYPE_OPTIONS.map(
    (opt) => `<option value="${opt.value}">${opt.label}</option>`
  ).join('');

  container.innerHTML = state.builderFields
    .map(
      (field, index) => `
    <div class="builder-row" data-index="${index}">
      <input type="text" class="field-label" placeholder="Label" value="${escapeHtml(field.label || '')}">
      <input type="text" class="field-selector" placeholder="CSS selector e.g. #email" value="${escapeHtml(field.selector || '')}">
      <select class="field-type">${typeOptions}</select>
      <input type="text" class="field-fixed" placeholder="Fixed value (optional)" value="${escapeHtml(field.fixedValue || '')}">
      <button class="btn-icon remove-field" title="Remove">×</button>
    </div>`
    )
    .join('');

  container.querySelectorAll('.field-type').forEach((select, i) => {
    select.value = state.builderFields[i].type || 'text';
  });
}

function addBuilderField() {
  state.builderFields.push({
    label: '',
    selector: '',
    type: 'text',
    htmlType: 'text',
    fixedValue: '',
  });
  renderBuilderFields();
}

function collectBuilderFields() {
  const rows = document.querySelectorAll('.builder-row');
  return [...rows].map((row, index) => ({
    label: row.querySelector('.field-label').value.trim() || `Field ${index + 1}`,
    selector: row.querySelector('.field-selector').value.trim(),
    type: row.querySelector('.field-type').value,
    htmlType: 'text',
    fixedValue: row.querySelector('.field-fixed').value.trim() || null,
  }));
}

async function handleBuilderGenerate() {
  state.builderFields = collectBuilderFields();
  const valid = state.builderFields.filter((f) => f.selector);
  if (!valid.length) {
    showStatus('Add at least one field with a selector.', true);
    return;
  }
  const preview = await resolveSelectValues(generateDemoData(valid));
  renderPreviewTable('builder-preview', preview);
  state.builderPreview = preview;
  showStatus('Demo data generated.');
}

async function handleBuilderSave() {
  const name = document.getElementById('builder-name').value.trim();
  if (!name) {
    showStatus('Enter a template name.', true);
    return;
  }

  const fields = collectBuilderFields().filter((f) => f.selector);
  if (!fields.length) {
    showStatus('Add at least one field with a selector.', true);
    return;
  }

  await save({
    id: state.editingTemplateId || undefined,
    name,
    urlPattern: document.getElementById('builder-url').value.trim(),
    fields,
  });

  state.editingTemplateId = null;
  state.builderFields = [];
  document.getElementById('builder-name').value = '';
  document.getElementById('builder-url').value = '';
  renderBuilderFields();
  document.getElementById('builder-preview').innerHTML = '';
  await renderTemplates();
  showStatus('Template saved.');
}

async function handleBuilderFill() {
  await handleBuilderGenerate();
  if (state.builderPreview?.length) {
    await handleFill(state.builderPreview);
  }
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function updateAiSettingsVisibility() {
  const el = document.getElementById('ai-settings');
  if (el) el.classList.toggle('hidden', state.genMode !== 'ai');
}

async function handleSaveApiKey() {
  const input = document.getElementById('api-key-input');
  const key = input.value.trim();
  state.aimlApiKey = key;
  await saveSettings({ aimlApiKey: key });
  showStatus(key ? 'API key saved.' : 'API key cleared.');
}

function initGenModeToggle() {
  const radios = document.querySelectorAll('input[name="gen-mode"]');
  radios.forEach((radio) => {
    radio.checked = radio.value === state.genMode;
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      state.genMode = radio.value;
      await saveSettings({ genMode: state.genMode });
      updateAiSettingsVisibility();
      if (state.scannedFields.length) {
        await regeneratePreview();
      }
    });
  });
  updateAiSettingsVisibility();
}

function initApiKeyField() {
  const input = document.getElementById('api-key-input');
  input.value = state.aimlApiKey;
  document.getElementById('save-api-key-btn').addEventListener('click', handleSaveApiKey);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveApiKey();
  });
}

function initScanTab() {
  initGenModeToggle();
  initApiKeyField();
  document.getElementById('scan-btn').addEventListener('click', handleScan);
  document.getElementById('regenerate-btn').addEventListener('click', () => regeneratePreview());
  document.getElementById('fill-btn').addEventListener('click', () => handleFill(state.previewData));
  document.getElementById('save-template-btn').addEventListener('click', handleSaveScanTemplate);
}

function initTemplatesTab() {
  bindTemplateListEvents(document.getElementById('pinned-list'));
  bindTemplateListEvents(document.getElementById('recent-list'));
  bindTemplateListEvents(document.getElementById('all-list'));
  document.getElementById('template-search').addEventListener('input', renderTemplates);
}

function initCreateTab() {
  document.getElementById('add-field-btn').addEventListener('click', addBuilderField);
  document.getElementById('builder-generate-btn').addEventListener('click', handleBuilderGenerate);
  document.getElementById('builder-save-btn').addEventListener('click', handleBuilderSave);
  document.getElementById('builder-fill-btn').addEventListener('click', handleBuilderFill);

  document.getElementById('builder-fields').addEventListener('click', (e) => {
    if (e.target.closest('.remove-field')) {
      const index = Number(e.target.closest('.builder-row').dataset.index);
      state.builderFields = collectBuilderFields();
      state.builderFields.splice(index, 1);
      renderBuilderFields();
    }
  });
}

function initMinimize() {
  const minimizeBtn = document.getElementById('minimize-btn');
  minimizeBtn.addEventListener('click', toggleMinimize);
}

function toggleMinimize() {
  state.minimized = !state.minimized;
  document.body.classList.toggle('minimized', state.minimized);

  const minimizeBtn = document.getElementById('minimize-btn');
  minimizeBtn.textContent = state.minimized ? '□' : '—';
  minimizeBtn.title = state.minimized ? 'Restore' : 'Minimize';
}

async function init() {
  initMinimize();
  initTabs();

  const settings = await getSettings();
  state.genMode = settings.genMode || 'faker';
  state.aimlApiKey = settings.aimlApiKey || '';

  initScanTab();
  initTemplatesTab();
  initCreateTab();

  const tab = await getActiveTab();
  state.currentTabUrl = tab?.url || '';
  const nameInput = document.getElementById('template-name');
  try {
    nameInput.placeholder = `Template for ${new URL(tab.url).hostname}`;
  } catch {
    nameInput.placeholder = 'Template name';
  }

  await renderTemplates();
}

document.addEventListener('DOMContentLoaded', init);

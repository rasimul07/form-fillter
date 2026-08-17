import { detectFieldType } from './field-types.js';

function cleanLabelText(text) {
  return (text || '').replace(/\s*\*\s*$/, '').trim();
}

function getLabel(element) {
  const formControl = element.closest('.MuiFormControl-root, .MuiAutocomplete-root');
  if (formControl) {
    const muiLabel = formControl.querySelector('label.MuiInputLabel-root, label.MuiFormLabel-root');
    if (muiLabel) return cleanLabelText(muiLabel.textContent);
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const labelEl = document.getElementById(id);
      if (labelEl?.textContent.trim()) return cleanLabelText(labelEl.textContent);
    }
  }

  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) return cleanLabelText(label.textContent);
  }

  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    clone.querySelectorAll('input, textarea, select').forEach((el) => el.remove());
    const text = clone.textContent.trim();
    if (text) return cleanLabelText(text);
  }

  return cleanLabelText(
    element.getAttribute('aria-label') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('name') ||
      element.id ||
      element.tagName.toLowerCase()
  );
}

function getSelector(element) {
  if (element.id) {
    const idSel = `#${CSS.escape(element.id)}`;
    if (document.querySelectorAll(idSel).length === 1) return idSel;
  }

  const tag = element.tagName.toLowerCase();
  if (element.name) {
    const nameSel = `${tag}[name="${CSS.escape(element.name)}"]`;
    if (document.querySelectorAll(nameSel).length === 1) return nameSel;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();

    if (current.id) {
      part += `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((s) => s.tagName === current.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.type === 'hidden') return false;
  return element.offsetParent !== null || style.position === 'fixed';
}

function isHiddenSelectInput(element) {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.classList.contains('MuiSelect-nativeInput')) return true;
  if (element.classList.contains('MuiAutocomplete-nativeInput')) return true;
  if (element.getAttribute('aria-hidden') === 'true' && element.closest('.MuiSelect-root, .MuiAutocomplete-root')) {
    return true;
  }
  return false;
}

function getMuiSelectName(element) {
  const root = element.closest('.MuiSelect-root, .MuiAutocomplete-root');
  if (!root) return '';
  const nativeInput = root.querySelector('input.MuiSelect-nativeInput, input.MuiAutocomplete-nativeInput');
  return nativeInput?.getAttribute('name') || '';
}

function isCustomSelectTrigger(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLSelectElement) return false;

  if (element.classList.contains('MuiSelect-select') && element.getAttribute('role') === 'combobox') {
    return true;
  }
  if (element.classList.contains('ant-select-selector')) return true;

  const role = element.getAttribute('role');
  const hasPopup = element.getAttribute('aria-haspopup');
  if (role === 'combobox') return true;
  if (hasPopup === 'listbox' && role !== 'listbox') return true;

  return false;
}

function scanInput(element) {
  if (isHiddenSelectInput(element)) return null;

  const htmlType = (element.type || 'text').toLowerCase();
  if (['submit', 'button', 'reset', 'image', 'file'].includes(htmlType)) return null;
  if (!isVisible(element) && htmlType !== 'checkbox' && htmlType !== 'radio') return null;

  const meta = {
    selector: getSelector(element),
    label: getLabel(element),
    name: element.name || '',
    id: element.id || '',
    placeholder: element.placeholder || '',
    autocomplete: element.autocomplete || '',
    htmlType,
    tagName: element.tagName.toLowerCase(),
  };

  meta.detectedType = detectFieldType(meta);
  return meta;
}

function scanCustomSelect(element) {
  if (!(element instanceof HTMLElement)) return null;
  if (element instanceof HTMLSelectElement) return null;
  if (!isVisible(element)) return null;
  if (!isCustomSelectTrigger(element)) return null;

  const parentCombobox = element.parentElement?.closest('[role="combobox"]');
  if (parentCombobox && parentCombobox !== element) return null;

  const meta = {
    selector: getSelector(element),
    label: getLabel(element),
    name: element.getAttribute('name') || getMuiSelectName(element),
    id: element.id || '',
    placeholder: element.getAttribute('placeholder') || '',
    autocomplete: element.getAttribute('aria-autocomplete') || '',
    htmlType: 'custom-select',
    tagName: element.tagName.toLowerCase(),
    muiSelect: element.classList.contains('MuiSelect-select'),
  };

  meta.detectedType = detectFieldType(meta);
  return meta;
}

function scanSelect(element) {
  if (!isVisible(element)) return null;

  const meta = {
    selector: getSelector(element),
    label: getLabel(element),
    name: element.name || '',
    id: element.id || '',
    placeholder: '',
    autocomplete: element.autocomplete || '',
    htmlType: 'select',
    tagName: 'select',
    options: [...element.options].map((opt) => ({
      value: opt.value,
      text: opt.textContent.trim(),
    })),
  };

  meta.detectedType = detectFieldType(meta);
  return meta;
}

function addField(fields, seen, field) {
  if (!field || seen.has(field.selector)) return;
  seen.add(field.selector);
  fields.push(field);
}

export function scanFields() {
  const fields = [];
  const seen = new Set();

  document.querySelectorAll('div.MuiSelect-select[role="combobox"], .ant-select-selector').forEach((element) => {
    addField(fields, seen, scanCustomSelect(element));
  });

  document.querySelectorAll('select').forEach((element) => {
    addField(fields, seen, scanSelect(element));
  });

  document.querySelectorAll('input, textarea').forEach((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      addField(fields, seen, scanInput(element));
    }
  });

  document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]').forEach((element) => {
    addField(fields, seen, scanCustomSelect(element));
  });

  return fields;
}

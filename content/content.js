import { scanFields } from '../lib/field-scanner.js';
import {
  pickRandomFromSelectElement,
  setNativeSelectValue,
  openAndPickRandomOption,
} from '../lib/select-utils.js';

function isSelectField(field) {
  return field.htmlType === 'select' || field.htmlType === 'custom-select';
}

function setNativeValue(element, value) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function resolveSelectValues(fields) {
  const resolved = [];

  for (const field of fields) {
    if (!isSelectField(field)) {
      resolved.push(field);
      continue;
    }

    const hasFixed =
      field.fixedValue !== null && field.fixedValue !== undefined && field.fixedValue !== '';
    if (hasFixed) {
      resolved.push({ ...field, value: field.fixedValue });
      continue;
    }

    const element = document.querySelector(field.selector);
    if (!element) {
      resolved.push(field);
      continue;
    }

    if (field.htmlType === 'custom-select') {
      const result = await openAndPickRandomOption(element, field.value || null);
      resolved.push({
        ...field,
        value: result.success ? result.text : field.value || '',
      });
      continue;
    }

    resolved.push({
      ...field,
      value: pickRandomFromSelectElement(element),
    });
  }

  return resolved;
}

async function fillField(entry) {
  const element = document.querySelector(entry.selector);
  if (!element) return { selector: entry.selector, success: false, reason: 'not found' };
  if (element.disabled) return { selector: entry.selector, success: false, reason: 'disabled' };

  try {
    if (entry.htmlType === 'custom-select') {
      const result = await openAndPickRandomOption(element, entry.value || null);
      return { selector: entry.selector, success: result.success };
    }

    if (element instanceof HTMLSelectElement) {
      const hasFixed =
        entry.fixedValue !== null && entry.fixedValue !== undefined && entry.fixedValue !== '';
      const value = hasFixed
        ? entry.fixedValue
        : entry.value ?? pickRandomFromSelectElement(element);

      const success = setNativeSelectValue(element, value);
      return { selector: entry.selector, success };
    }

    if (element instanceof HTMLInputElement) {
      const type = (element.type || 'text').toLowerCase();
      if (type === 'checkbox') {
        element.checked = Boolean(entry.value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { selector: entry.selector, success: true };
      }
      if (type === 'radio') {
        element.checked = true;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { selector: entry.selector, success: true };
      }
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setNativeValue(element, String(entry.value ?? ''));
      return { selector: entry.selector, success: true };
    }

    return { selector: entry.selector, success: false, reason: 'unsupported element' };
  } catch (err) {
    return { selector: entry.selector, success: false, reason: err.message };
  }
}

async function fillForm(fields) {
  const results = [];
  for (const field of fields) {
    results.push(await fillField(field));
  }
  return results;
}

function getPageContext() {
  const dialog = document.querySelector('[role="dialog"]');
  const formTitle =
    dialog?.querySelector('h1, h2, h3')?.textContent?.trim() ||
    document.querySelector('h1, h2')?.textContent?.trim() ||
    '';

  return {
    title: document.title,
    url: location.href,
    formTitle,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'scanFields') {
    sendResponse({ fields: scanFields() });
    return true;
  }

  if (message.action === 'getPageContext') {
    sendResponse(getPageContext());
    return true;
  }

  if (message.action === 'fillForm') {
    resolveSelectValues(message.fields || [])
      .then((resolved) => fillForm(resolved))
      .then((results) => sendResponse({ results }));
    return true;
  }

  if (message.action === 'resolveSelectValues') {
    resolveSelectValues(message.fields || []).then((fields) => sendResponse({ fields }));
    return true;
  }

  return false;
});

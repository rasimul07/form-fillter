export function pickRandomFromOptions(options) {
  const usable = options.filter(
    (opt) =>
      !opt.disabled &&
      opt.value !== '' &&
      !/^(select|choose|pick|--|-+)$/i.test((opt.text || '').trim())
  );
  const pool = usable.length
    ? usable
    : options.filter((opt) => !opt.disabled && (opt.value !== '' || (opt.text || '').trim()));

  if (!pool.length) return '';
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.value !== '' ? pick.value : (pick.text || '').trim();
}

export function pickRandomFromSelectElement(element) {
  if (!(element instanceof HTMLSelectElement)) return '';
  const options = [...element.options].map((opt) => ({
    value: opt.value,
    text: opt.textContent.trim(),
    disabled: opt.disabled,
  }));
  return pickRandomFromOptions(options);
}

function findMatchingOption(options, value) {
  if (value === null || value === undefined || value === '') return null;

  const strValue = String(value);
  return (
    options.find((opt) => opt.value === strValue) ||
    options.find((opt) => opt.textContent.trim() === strValue) ||
    options.find(
      (opt) => opt.textContent.trim().toLowerCase() === strValue.toLowerCase()
    )
  );
}

export function setNativeSelectValue(element, value) {
  if (!(element instanceof HTMLSelectElement)) return false;

  const options = [...element.options];
  const match = findMatchingOption(options, value);
  if (!match) return false;

  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, match.value);
  } else {
    element.value = match.value;
  }

  element.selectedIndex = options.indexOf(match);

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isListboxVisible(listbox) {
  if (!listbox) return false;
  const style = window.getComputedStyle(listbox);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (listbox.getAttribute('aria-hidden') === 'true') return false;
  return listbox.offsetParent !== null || style.position === 'fixed';
}

function findVisibleListboxes() {
  const listboxes = [];

  for (const listbox of document.querySelectorAll('[role="listbox"]')) {
    if (isListboxVisible(listbox)) listboxes.push(listbox);
  }

  for (const listbox of document.querySelectorAll(
    '.MuiPopover-root [role="listbox"], .MuiMenu-root [role="listbox"], [data-radix-popper-content-wrapper] [role="listbox"]'
  )) {
    if (isListboxVisible(listbox) && !listboxes.includes(listbox)) {
      listboxes.push(listbox);
    }
  }

  return listboxes;
}

function getListboxOptions(listbox) {
  return [...listbox.querySelectorAll('[role="option"], .MuiMenuItem-root, .ant-select-item-option')].filter((opt) => {
    if (opt.getAttribute('aria-disabled') === 'true') return false;
    const text = opt.textContent.trim();
    if (!text) return false;
    if (/^(select|choose|pick|--|-+)$/i.test(text)) return false;
    return true;
  });
}

function getOptionText(option) {
  return option.textContent.trim();
}

async function closeOpenListboxes() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  await sleep(100);
}

export async function openAndPickRandomOption(trigger, preferredValue = null) {
  if (!trigger) return { success: false, text: '', value: '' };

  await closeOpenListboxes();

  trigger.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  trigger.focus();

  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  trigger.click();

  trigger.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true })
  );
  trigger.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true })
  );

  let listbox = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(80);
    const listboxes = findVisibleListboxes();
    if (listboxes.length) {
      listbox = listboxes[listboxes.length - 1];
      break;
    }
  }

  if (!listbox) {
    return { success: false, text: '', value: '' };
  }

  const options = getListboxOptions(listbox);
  if (!options.length) {
    await closeOpenListboxes();
    return { success: false, text: '', value: '' };
  }

  let pick = null;
  if (preferredValue) {
    pick =
      options.find((opt) => getOptionText(opt) === preferredValue) ||
      options.find(
        (opt) => getOptionText(opt).toLowerCase() === String(preferredValue).toLowerCase()
      );
  }
  if (!pick) {
    pick = options[Math.floor(Math.random() * options.length)];
  }

  const text = getOptionText(pick);
  pick.scrollIntoView({ block: 'nearest' });
  pick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  pick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  pick.click();

  await sleep(120);
  return { success: true, text, value: text };
}

export async function fillCustomSelectElement(element, preferredValue = null) {
  const result = await openAndPickRandomOption(element, preferredValue);
  return result.success;
}

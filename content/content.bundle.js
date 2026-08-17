(() => {
  // lib/field-types.js
  var FIELD_TYPES = {
    email: "email",
    phone: "phone",
    firstName: "firstName",
    lastName: "lastName",
    fullName: "fullName",
    password: "password",
    date: "date",
    address: "address",
    city: "city",
    zip: "zip",
    country: "country",
    number: "number",
    url: "url",
    company: "company",
    text: "text"
  };
  var FIELD_TYPE_OPTIONS = [
    { value: FIELD_TYPES.email, label: "Email" },
    { value: FIELD_TYPES.phone, label: "Phone" },
    { value: FIELD_TYPES.firstName, label: "First Name" },
    { value: FIELD_TYPES.lastName, label: "Last Name" },
    { value: FIELD_TYPES.fullName, label: "Full Name" },
    { value: FIELD_TYPES.password, label: "Password" },
    { value: FIELD_TYPES.date, label: "Date" },
    { value: FIELD_TYPES.address, label: "Address" },
    { value: FIELD_TYPES.city, label: "City" },
    { value: FIELD_TYPES.zip, label: "ZIP / Postal Code" },
    { value: FIELD_TYPES.country, label: "Country" },
    { value: FIELD_TYPES.number, label: "Number" },
    { value: FIELD_TYPES.url, label: "URL" },
    { value: FIELD_TYPES.company, label: "Company" },
    { value: FIELD_TYPES.text, label: "Text" }
  ];
  function normalize(text) {
    return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function haystack(meta) {
    return normalize(
      [meta.label, meta.name, meta.id, meta.placeholder, meta.autocomplete].join(" ")
    );
  }
  function detectFieldType(meta) {
    const htmlType = (meta.htmlType || "").toLowerCase();
    const text = haystack(meta);
    if (htmlType === "email" || text.includes("email")) return FIELD_TYPES.email;
    if (htmlType === "tel" || text.includes("phone") || text.includes("mobile") || text.includes("tel"))
      return FIELD_TYPES.phone;
    if (htmlType === "password" || text.includes("password") || text.includes("passwd"))
      return FIELD_TYPES.password;
    if (htmlType === "url" || text.includes("website") || text.includes("url"))
      return FIELD_TYPES.url;
    if (htmlType === "number" || text.includes("age") || text.includes("quantity"))
      return FIELD_TYPES.number;
    if (htmlType === "date" || text.includes("birth") || text.includes("dob") || text.includes("date"))
      return FIELD_TYPES.date;
    if (text.includes("firstname") || text.includes("fname") || text.includes("first") && text.includes("name"))
      return FIELD_TYPES.firstName;
    if (text.includes("lastname") || text.includes("lname") || text.includes("last") && text.includes("name"))
      return FIELD_TYPES.lastName;
    if (text.includes("fullname") || text === "name" || text.endsWith("name"))
      return FIELD_TYPES.fullName;
    if (text.includes("address") || text.includes("street")) return FIELD_TYPES.address;
    if (text.includes("city") || text.includes("town")) return FIELD_TYPES.city;
    if (text.includes("zip") || text.includes("postal") || text.includes("postcode")) return FIELD_TYPES.zip;
    if (text.includes("country") || text.includes("nation")) return FIELD_TYPES.country;
    if (text.includes("company") || text.includes("organization") || text.includes("employer"))
      return FIELD_TYPES.company;
    return FIELD_TYPES.text;
  }

  // lib/field-scanner.js
  function cleanLabelText(text) {
    return (text || "").replace(/\s*\*\s*$/, "").trim();
  }
  function getLabel(element) {
    const formControl = element.closest(".MuiFormControl-root, .MuiAutocomplete-root");
    if (formControl) {
      const muiLabel = formControl.querySelector("label.MuiInputLabel-root, label.MuiFormLabel-root");
      if (muiLabel) return cleanLabelText(muiLabel.textContent);
    }
    const labelledBy = element.getAttribute("aria-labelledby");
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
    const parentLabel = element.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, textarea, select").forEach((el) => el.remove());
      const text = clone.textContent.trim();
      if (text) return cleanLabelText(text);
    }
    return cleanLabelText(
      element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || element.id || element.tagName.toLowerCase()
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
    return parts.join(" > ");
  }
  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (element.type === "hidden") return false;
    return element.offsetParent !== null || style.position === "fixed";
  }
  function isHiddenSelectInput(element) {
    if (!(element instanceof HTMLInputElement)) return false;
    if (element.classList.contains("MuiSelect-nativeInput")) return true;
    if (element.classList.contains("MuiAutocomplete-nativeInput")) return true;
    if (element.getAttribute("aria-hidden") === "true" && element.closest(".MuiSelect-root, .MuiAutocomplete-root")) {
      return true;
    }
    return false;
  }
  function getMuiSelectName(element) {
    const root = element.closest(".MuiSelect-root, .MuiAutocomplete-root");
    if (!root) return "";
    const nativeInput = root.querySelector("input.MuiSelect-nativeInput, input.MuiAutocomplete-nativeInput");
    return nativeInput?.getAttribute("name") || "";
  }
  function isCustomSelectTrigger(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element instanceof HTMLSelectElement) return false;
    if (element.classList.contains("MuiSelect-select") && element.getAttribute("role") === "combobox") {
      return true;
    }
    if (element.classList.contains("ant-select-selector")) return true;
    const role = element.getAttribute("role");
    const hasPopup = element.getAttribute("aria-haspopup");
    if (role === "combobox") return true;
    if (hasPopup === "listbox" && role !== "listbox") return true;
    return false;
  }
  function scanInput(element) {
    if (isHiddenSelectInput(element)) return null;
    const htmlType = (element.type || "text").toLowerCase();
    if (["submit", "button", "reset", "image", "file"].includes(htmlType)) return null;
    if (!isVisible(element) && htmlType !== "checkbox" && htmlType !== "radio") return null;
    const meta = {
      selector: getSelector(element),
      label: getLabel(element),
      name: element.name || "",
      id: element.id || "",
      placeholder: element.placeholder || "",
      autocomplete: element.autocomplete || "",
      htmlType,
      tagName: element.tagName.toLowerCase()
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
      name: element.getAttribute("name") || getMuiSelectName(element),
      id: element.id || "",
      placeholder: element.getAttribute("placeholder") || "",
      autocomplete: element.getAttribute("aria-autocomplete") || "",
      htmlType: "custom-select",
      tagName: element.tagName.toLowerCase(),
      muiSelect: element.classList.contains("MuiSelect-select")
    };
    meta.detectedType = detectFieldType(meta);
    return meta;
  }
  function scanSelect(element) {
    if (!isVisible(element)) return null;
    const meta = {
      selector: getSelector(element),
      label: getLabel(element),
      name: element.name || "",
      id: element.id || "",
      placeholder: "",
      autocomplete: element.autocomplete || "",
      htmlType: "select",
      tagName: "select",
      options: [...element.options].map((opt) => ({
        value: opt.value,
        text: opt.textContent.trim()
      }))
    };
    meta.detectedType = detectFieldType(meta);
    return meta;
  }
  function addField(fields, seen, field) {
    if (!field || seen.has(field.selector)) return;
    seen.add(field.selector);
    fields.push(field);
  }
  function scanFields() {
    const fields = [];
    const seen = /* @__PURE__ */ new Set();
    document.querySelectorAll('div.MuiSelect-select[role="combobox"], .ant-select-selector').forEach((element) => {
      addField(fields, seen, scanCustomSelect(element));
    });
    document.querySelectorAll("select").forEach((element) => {
      addField(fields, seen, scanSelect(element));
    });
    document.querySelectorAll("input, textarea").forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        addField(fields, seen, scanInput(element));
      }
    });
    document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]').forEach((element) => {
      addField(fields, seen, scanCustomSelect(element));
    });
    return fields;
  }

  // lib/select-utils.js
  function pickRandomFromOptions(options) {
    const usable = options.filter(
      (opt) => !opt.disabled && opt.value !== "" && !/^(select|choose|pick|--|-+)$/i.test((opt.text || "").trim())
    );
    const pool = usable.length ? usable : options.filter((opt) => !opt.disabled && (opt.value !== "" || (opt.text || "").trim()));
    if (!pool.length) return "";
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return pick.value !== "" ? pick.value : (pick.text || "").trim();
  }
  function pickRandomFromSelectElement(element) {
    if (!(element instanceof HTMLSelectElement)) return "";
    const options = [...element.options].map((opt) => ({
      value: opt.value,
      text: opt.textContent.trim(),
      disabled: opt.disabled
    }));
    return pickRandomFromOptions(options);
  }
  function findMatchingOption(options, value) {
    if (value === null || value === void 0 || value === "") return null;
    const strValue = String(value);
    return options.find((opt) => opt.value === strValue) || options.find((opt) => opt.textContent.trim() === strValue) || options.find(
      (opt) => opt.textContent.trim().toLowerCase() === strValue.toLowerCase()
    );
  }
  function setNativeSelectValue(element, value) {
    if (!(element instanceof HTMLSelectElement)) return false;
    const options = [...element.options];
    const match = findMatchingOption(options, value);
    if (!match) return false;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(element, match.value);
    } else {
      element.value = match.value;
    }
    element.selectedIndex = options.indexOf(match);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function isListboxVisible(listbox) {
    if (!listbox) return false;
    const style = window.getComputedStyle(listbox);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (listbox.getAttribute("aria-hidden") === "true") return false;
    return listbox.offsetParent !== null || style.position === "fixed";
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
      if (opt.getAttribute("aria-disabled") === "true") return false;
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
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await sleep(100);
  }
  async function openAndPickRandomOption(trigger, preferredValue = null) {
    if (!trigger) return { success: false, text: "", value: "" };
    await closeOpenListboxes();
    trigger.scrollIntoView({ block: "nearest", behavior: "instant" });
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    trigger.click();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true })
    );
    trigger.dispatchEvent(
      new KeyboardEvent("keyup", { key: "ArrowDown", code: "ArrowDown", bubbles: true })
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
      return { success: false, text: "", value: "" };
    }
    const options = getListboxOptions(listbox);
    if (!options.length) {
      await closeOpenListboxes();
      return { success: false, text: "", value: "" };
    }
    let pick = null;
    if (preferredValue) {
      pick = options.find((opt) => getOptionText(opt) === preferredValue) || options.find(
        (opt) => getOptionText(opt).toLowerCase() === String(preferredValue).toLowerCase()
      );
    }
    if (!pick) {
      pick = options[Math.floor(Math.random() * options.length)];
    }
    const text = getOptionText(pick);
    pick.scrollIntoView({ block: "nearest" });
    pick.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    pick.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    pick.click();
    await sleep(120);
    return { success: true, text, value: text };
  }

  // content/content.js
  function isSelectField(field) {
    return field.htmlType === "select" || field.htmlType === "custom-select";
  }
  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function resolveSelectValues(fields) {
    const resolved = [];
    for (const field of fields) {
      if (!isSelectField(field)) {
        resolved.push(field);
        continue;
      }
      const hasFixed = field.fixedValue !== null && field.fixedValue !== void 0 && field.fixedValue !== "";
      if (hasFixed) {
        resolved.push({ ...field, value: field.fixedValue });
        continue;
      }
      const element = document.querySelector(field.selector);
      if (!element) {
        resolved.push(field);
        continue;
      }
      if (field.htmlType === "custom-select") {
        const result = await openAndPickRandomOption(element, field.value || null);
        resolved.push({
          ...field,
          value: result.success ? result.text : field.value || ""
        });
        continue;
      }
      resolved.push({
        ...field,
        value: pickRandomFromSelectElement(element)
      });
    }
    return resolved;
  }
  async function fillField(entry) {
    const element = document.querySelector(entry.selector);
    if (!element) return { selector: entry.selector, success: false, reason: "not found" };
    if (element.disabled) return { selector: entry.selector, success: false, reason: "disabled" };
    try {
      if (entry.htmlType === "custom-select") {
        const result = await openAndPickRandomOption(element, entry.value || null);
        return { selector: entry.selector, success: result.success };
      }
      if (element instanceof HTMLSelectElement) {
        const hasFixed = entry.fixedValue !== null && entry.fixedValue !== void 0 && entry.fixedValue !== "";
        const value = hasFixed ? entry.fixedValue : entry.value ?? pickRandomFromSelectElement(element);
        const success = setNativeSelectValue(element, value);
        return { selector: entry.selector, success };
      }
      if (element instanceof HTMLInputElement) {
        const type = (element.type || "text").toLowerCase();
        if (type === "checkbox") {
          element.checked = Boolean(entry.value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return { selector: entry.selector, success: true };
        }
        if (type === "radio") {
          element.checked = true;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return { selector: entry.selector, success: true };
        }
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        setNativeValue(element, String(entry.value ?? ""));
        return { selector: entry.selector, success: true };
      }
      return { selector: entry.selector, success: false, reason: "unsupported element" };
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
    const formTitle = dialog?.querySelector("h1, h2, h3")?.textContent?.trim() || document.querySelector("h1, h2")?.textContent?.trim() || "";
    return {
      title: document.title,
      url: location.href,
      formTitle
    };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "scanFields") {
      sendResponse({ fields: scanFields() });
      return true;
    }
    if (message.action === "getPageContext") {
      sendResponse(getPageContext());
      return true;
    }
    if (message.action === "fillForm") {
      resolveSelectValues(message.fields || []).then((resolved) => fillForm(resolved)).then((results) => sendResponse({ results }));
      return true;
    }
    if (message.action === "resolveSelectValues") {
      resolveSelectValues(message.fields || []).then((fields) => sendResponse({ fields }));
      return true;
    }
    return false;
  });
})();
//# sourceMappingURL=content.bundle.js.map

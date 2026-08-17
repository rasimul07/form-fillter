import { faker } from '@faker-js/faker';
import { FIELD_TYPES } from './field-types.js';

function formatDate(value, htmlType) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (htmlType === 'datetime-local') {
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  if (htmlType === 'month') return `${yyyy}-${mm}`;
  if (htmlType === 'time') {
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  }

  return `${yyyy}-${mm}-${dd}`;
}

function generateForType(type, field = {}) {
  switch (type) {
    case FIELD_TYPES.email:
      return faker.internet.email();
    case FIELD_TYPES.phone:
      return faker.phone.number();
    case FIELD_TYPES.firstName:
      return faker.person.firstName();
    case FIELD_TYPES.lastName:
      return faker.person.lastName();
    case FIELD_TYPES.fullName:
      return faker.person.fullName();
    case FIELD_TYPES.password:
      return faker.internet.password({ length: 12 });
    case FIELD_TYPES.date:
      return formatDate(faker.date.past({ years: 30 }), field.htmlType);
    case FIELD_TYPES.address:
      return faker.location.streetAddress();
    case FIELD_TYPES.city:
      return faker.location.city();
    case FIELD_TYPES.zip:
      return faker.location.zipCode();
    case FIELD_TYPES.country:
      return faker.location.country();
    case FIELD_TYPES.number:
      return String(faker.number.int({ min: 1, max: 9999 }));
    case FIELD_TYPES.url:
      return faker.internet.url();
    case FIELD_TYPES.company:
      return faker.company.name();
    case FIELD_TYPES.text:
    default:
      return faker.lorem.words({ min: 2, max: 4 });
  }
}

function isSelectLike(field) {
  return (
    field.htmlType === 'select' ||
    field.htmlType === 'custom-select' ||
    field.tagName === 'select' ||
    (field.options && field.options.length > 0)
  );
}

export function generateDemoData(fields) {
  return fields.map((field) => {
    const type = field.type || field.detectedType;
    const fixedValue = field.fixedValue;

    let value;
    if (fixedValue !== null && fixedValue !== undefined && fixedValue !== '') {
      value = fixedValue;
    } else if (field.htmlType === 'checkbox') {
      value = true;
    } else if (isSelectLike(field)) {
      value = null;
    } else {
      value = generateForType(type, field);
    }

    return {
      selector: field.selector,
      label: field.label,
      type,
      value,
      htmlType: field.htmlType,
      fixedValue: field.fixedValue ?? null,
    };
  });
}

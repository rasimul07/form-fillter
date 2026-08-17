export const FIELD_TYPES = {
  email: 'email',
  phone: 'phone',
  firstName: 'firstName',
  lastName: 'lastName',
  fullName: 'fullName',
  password: 'password',
  date: 'date',
  address: 'address',
  city: 'city',
  zip: 'zip',
  country: 'country',
  number: 'number',
  url: 'url',
  company: 'company',
  text: 'text',
};

export const FIELD_TYPE_OPTIONS = [
  { value: FIELD_TYPES.email, label: 'Email' },
  { value: FIELD_TYPES.phone, label: 'Phone' },
  { value: FIELD_TYPES.firstName, label: 'First Name' },
  { value: FIELD_TYPES.lastName, label: 'Last Name' },
  { value: FIELD_TYPES.fullName, label: 'Full Name' },
  { value: FIELD_TYPES.password, label: 'Password' },
  { value: FIELD_TYPES.date, label: 'Date' },
  { value: FIELD_TYPES.address, label: 'Address' },
  { value: FIELD_TYPES.city, label: 'City' },
  { value: FIELD_TYPES.zip, label: 'ZIP / Postal Code' },
  { value: FIELD_TYPES.country, label: 'Country' },
  { value: FIELD_TYPES.number, label: 'Number' },
  { value: FIELD_TYPES.url, label: 'URL' },
  { value: FIELD_TYPES.company, label: 'Company' },
  { value: FIELD_TYPES.text, label: 'Text' },
];

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function haystack(meta) {
  return normalize(
    [meta.label, meta.name, meta.id, meta.placeholder, meta.autocomplete].join(' ')
  );
}

export function detectFieldType(meta) {
  const htmlType = (meta.htmlType || '').toLowerCase();
  const text = haystack(meta);

  if (htmlType === 'email' || text.includes('email')) return FIELD_TYPES.email;
  if (htmlType === 'tel' || text.includes('phone') || text.includes('mobile') || text.includes('tel'))
    return FIELD_TYPES.phone;
  if (htmlType === 'password' || text.includes('password') || text.includes('passwd'))
    return FIELD_TYPES.password;
  if (htmlType === 'url' || text.includes('website') || text.includes('url'))
    return FIELD_TYPES.url;
  if (htmlType === 'number' || text.includes('age') || text.includes('quantity'))
    return FIELD_TYPES.number;
  if (htmlType === 'date' || text.includes('birth') || text.includes('dob') || text.includes('date'))
    return FIELD_TYPES.date;

  if (text.includes('firstname') || text.includes('fname') || (text.includes('first') && text.includes('name')))
    return FIELD_TYPES.firstName;
  if (text.includes('lastname') || text.includes('lname') || (text.includes('last') && text.includes('name')))
    return FIELD_TYPES.lastName;
  if (text.includes('fullname') || text === 'name' || text.endsWith('name'))
    return FIELD_TYPES.fullName;

  if (text.includes('address') || text.includes('street')) return FIELD_TYPES.address;
  if (text.includes('city') || text.includes('town')) return FIELD_TYPES.city;
  if (text.includes('zip') || text.includes('postal') || text.includes('postcode')) return FIELD_TYPES.zip;
  if (text.includes('country') || text.includes('nation')) return FIELD_TYPES.country;
  if (text.includes('company') || text.includes('organization') || text.includes('employer'))
    return FIELD_TYPES.company;

  return FIELD_TYPES.text;
}

import { AIML_API_KEY, AIML_API_URL, AIML_MODEL } from './config.js';
import { generateDemoData } from './demo-generator.js';

function buildPrompt(fields, pageContext) {
  const fieldList = fields.map((f) => ({
    selector: f.selector,
    label: f.label,
    type: f.detectedType || f.type,
    htmlType: f.htmlType,
    options: f.options?.map((o) => o.text || o.value).filter(Boolean) || null,
  }));

  return `You are a form-filling assistant. Generate realistic demo data for a web form.

Page context:
- Title: ${pageContext.formTitle || pageContext.title || 'Unknown'}
- URL: ${pageContext.url || 'Unknown'}

Fields to fill:
${JSON.stringify(fieldList, null, 2)}

Rules:
- Return ONLY valid JSON, no markdown or explanation
- Format: { "fields": [{ "selector": "...", "value": "..." }] }
- For email fields use realistic emails
- For phone use valid phone format
- For password use 12+ character passwords
- For date fields use YYYY-MM-DD format
- For select fields with an options array, value MUST be exactly one of the listed options
- For custom-select (dropdown) fields without options, generate a realistic value matching the field label and form context (e.g. "Goa" for State in an Indian branch form)
- For text fields, generate context-appropriate realistic values matching the form purpose
- Match all field selectors exactly`;
}

function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response did not contain JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    throw new Error('AI response missing fields array');
  }
  return parsed.fields;
}

export async function generateWithAI(fields, pageContext = {}, apiKey) {
  const key = apiKey || AIML_API_KEY;
  if (!key) {
    throw new Error('Enter your AIML API key below to use AI generation');
  }

  const response = await fetch(AIML_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AIML_MODEL,
      messages: [
        {
          role: 'user',
          content: buildPrompt(fields, pageContext),
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  const aiFields = parseAIResponse(content);
  const valueMap = new Map(aiFields.map((f) => [f.selector, f.value]));

  return fields.map((field) => {
    const type = field.detectedType || field.type;
    const aiValue = valueMap.get(field.selector);

    return {
      selector: field.selector,
      label: field.label,
      type,
      value: aiValue ?? null,
      htmlType: field.htmlType,
      fixedValue: field.fixedValue ?? null,
      options: field.options || null,
    };
  });
}

export async function generateData(fields, pageContext, mode, options = {}) {
  if (mode === 'ai') {
    return generateWithAI(fields, pageContext, options.apiKey);
  }

  return generateDemoData(fields.map((f) => ({ ...f, type: f.detectedType || f.type })));
}

/* global __AIML_MODEL__ */
export const AIML_API_URL = 'https://api.openai.com/v1/chat/completions';
export const AIML_MODEL = typeof __AIML_MODEL__ !== 'undefined' ? __AIML_MODEL__ : 'gpt-4o';

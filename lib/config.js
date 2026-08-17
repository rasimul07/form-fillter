/* global __AIML_API_KEY__, __AIML_MODEL__ */
export const AIML_API_KEY = typeof __AIML_API_KEY__ !== 'undefined' ? __AIML_API_KEY__ : '';
export const AIML_API_URL = 'https://api.aimlapi.com/v1/chat/completions';
export const AIML_MODEL = typeof __AIML_MODEL__ !== 'undefined' ? __AIML_MODEL__ : 'openai/gpt-4o';

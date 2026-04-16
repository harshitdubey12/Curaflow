import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { classifyDepartmentFromKeywords } from './departmentKeywords.util.js';

export { classifyDepartmentFromKeywords };

export const DEPARTMENTS = /** @type {const} */ (['general', 'dental', 'skin']);

const CLASSIFY_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

function cleanGeminiKey(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function geminiKey() {
  return cleanGeminiKey(config.geminiApiKey);
}

function extractTextFromResult(result) {
  try {
    const t = result.response?.text?.();
    if (t && String(t).trim()) return String(t).trim().toLowerCase();
  } catch {
    /* fall through */
  }
  const parts = result.response?.candidates?.[0]?.content?.parts;
  if (parts?.length) {
    const joined = parts.map((p) => p.text || '').join('');
    if (joined.trim()) return joined.trim().toLowerCase();
  }
  return '';
}

/**
 * @param {string | null | undefined} raw
 * @returns {'general' | 'dental' | 'skin'}
 */
export function normalizeDepartment(raw) {
  const s = String(raw ?? 'general')
    .trim()
    .toLowerCase();
  if (s === 'dental' || s === 'dentistry' || s === 'teeth' || s === 'tooth') return 'dental';
  if (s === 'skin' || s === 'derma' || s === 'dermatology') return 'skin';
  return 'general';
}

/**
 * Maps raw Gemini (or stub) classification output to a canonical department.
 * @param {string | null | undefined} text
 * @returns {{ department: 'general' | 'dental' | 'skin', needsClarification: boolean }}
 */
export function parseDepartmentFromGeminiText(text) {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return { department: 'general', needsClarification: false };
  }
  const one = raw.replace(/[^a-z]/gi, '').toLowerCase();
  if (one.includes('dental') || one === 'dental') {
    return { department: 'dental', needsClarification: false };
  }
  if (one.includes('skin') || one === 'skin') {
    return { department: 'skin', needsClarification: false };
  }
  if (one.includes('general') || one === 'general') {
    return { department: 'general', needsClarification: false };
  }
  return { department: normalizeDepartment(text), needsClarification: false };
}

/**
 * Classify patient into a queue department lane (general, dental, skin).
 * On failure or no API key after keywords: department "general" means the general lane, not FAQ chat text.
 * FAQ text when Gemini is offline is buildOfflineFaqResponse in aiService (separate from this).
 * @param {string | null | undefined} symptoms
 * @returns {Promise<{ department: 'general' | 'dental' | 'skin', needsClarification: boolean }>}
 */
export async function classifyDepartment(symptoms) {
  const raw = String(symptoms ?? '').trim();
  if (raw.length < 3) {
    return { department: 'general', needsClarification: true };
  }

  const fromKw = classifyDepartmentFromKeywords(raw);
  if (fromKw.matched) {
    return { department: fromKw.department, needsClarification: false };
  }

  const key = geminiKey();
  if (!key) {
    return { department: 'general', needsClarification: false };
  }

  const prompt = `Classify this patient into one department:
- general
- dental
- skin

Symptoms: ${raw}

Reply with exactly one word: general, dental, or skin. No punctuation.`;

  try {
    const genAI = new GoogleGenerativeAI(key);
    let text = '';
    for (const modelName of CLASSIFY_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { maxOutputTokens: 32, temperature: 0.2 },
        });
        const result = await model.generateContent(prompt);
        text = extractTextFromResult(result);
        if (text) break;
      } catch {
        /* try next model */
      }
    }
    return parseDepartmentFromGeminiText(text);
  } catch (e) {
    console.warn('[departmentService] classifyDepartment failed:', e?.message || e);
    return { department: 'general', needsClarification: false };
  }
}

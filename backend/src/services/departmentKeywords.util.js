/**
 * Deterministic routing before Gemini (or when no API key).
 * Order: dental → skin → general (symptoms that clearly belong in primary care).
 */

const DENTAL =
  /\b(tooth|teeth|dental|dentist|gums?|cavity|cavities|molar|molars|oral|braces?|denture|wisdom\s+tooth)\b/i;

const SKIN =
  /\b(skin|rash|dermat|acne|mole|itch|hives?|eczema|psoriasis|wart|blister|peeling|sunburn)\b/i;

/** Primary-care style symptoms (includes fever, cough, etc.). */
/** Excludes chest pain so urgent-care flow can apply; see isLikelyMedicalEmergency on registration. */
const GENERAL =
  /\b(fever|temperature|chills|cold|flu|influenza|cough|sore throat|headache|migraine|body ache|stomach|nausea|vomit|diarrhea|constipation|fatigue|dizz|back pain|joint pain|earache|urinary|abdomen|general)\b/i;

/**
 * @param {string | null | undefined} symptoms
 * @returns {{ department: 'general' | 'dental' | 'skin', matched: boolean }}
 */
export function classifyDepartmentFromKeywords(symptoms) {
  const t = String(symptoms ?? '').trim();
  if (t.length < 3) {
    return { department: 'general', matched: false };
  }
  if (DENTAL.test(t)) {
    return { department: 'dental', matched: true };
  }
  if (SKIN.test(t)) {
    return { department: 'skin', matched: true };
  }
  if (GENERAL.test(t)) {
    return { department: 'general', matched: true };
  }
  return { department: 'general', matched: false };
}

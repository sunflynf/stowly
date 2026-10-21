// Voice search: the browser's built-in speech recognition (Web Speech API).
// Chrome, Edge and Safari support it, including Vietnamese; Firefox does not,
// and then the microphone button is simply not shown.

/** The parts of the Web Speech API we use (not in TypeScript's DOM types). */
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** BCP 47 tag for the recogniser, from the UI language. */
export function speechLang(locale: string) {
  return locale === "en" ? "en-US" : "vi-VN";
}

// Words around the item name in a spoken question. Longest first, matched as
// whole words, case- and punctuation-insensitive. Diacritics are kept: they are
// part of Vietnamese words, and search ignores them anyway.
const VI_PHRASES = [
  "để ở đâu", "nằm ở đâu", "cất ở đâu", "ở chỗ nào", "ở đâu vậy", "ở đâu rồi", "đâu rồi", "ở đâu", "chỗ nào",
  "tìm giúp tôi", "tìm giúp", "tìm cho tôi", "tìm", "cho tôi biết", "của tôi", "của mình", "nhà mình",
  "cái", "chiếc", "cây", "bộ", "hộp", "những", "các", "vậy", "nhỉ", "nhé", "đâu", "ạ",
];
const EN_PHRASES = [
  "where did i put", "where did i leave", "where are my", "where is my", "where's my", "where are the",
  "where is the", "where's the", "where are", "where is", "where's", "where", "do i have", "do we have",
  "find me", "find my", "find the", "find", "look for", "search for", "show me", "my", "the", "a", "an", "any", "please",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turns a spoken question ("where's the drill?") into a search query ("drill"). */
export function voiceToQuery(transcript: string, locale: string): string {
  let text = transcript.toLowerCase().replace(/[?!.,;:"“”]/g, " ");
  const phrases = (locale === "en" ? [...EN_PHRASES, ...VI_PHRASES] : [...VI_PHRASES, ...EN_PHRASES]).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    // Whole words only: (start or space) phrase (space or end).
    text = text.replace(new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "gu"), " ");
  }
  const query = text.replace(/\s+/g, " ").trim();
  // If everything was filler, search for what was said rather than nothing.
  return query || transcript.trim();
}

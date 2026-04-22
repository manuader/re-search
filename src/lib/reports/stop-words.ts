// ---------------------------------------------------------------------------
// Report Pipeline — Stop Words (EN + ES)
// ---------------------------------------------------------------------------

const EN = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "is", "was", "are", "were", "been", "being", "has", "had", "did", "does",
  "its", "than", "how", "then", "also", "more", "very", "much", "too",
  "rt", "via", "http", "https", "www", "com",
]);

const ES = new Set([
  "el", "la", "de", "en", "y", "que", "un", "una", "es", "los",
  "las", "del", "por", "con", "no", "se", "al", "lo", "su", "para",
  "como", "pero", "más", "mas", "ya", "o", "fue", "este", "ha", "si",
  "sin", "sobre", "también", "tambien", "me", "hasta", "hay", "donde",
  "le", "nos", "les", "ni", "muy", "ser", "está", "esta", "yo", "eso",
  "son", "era", "todo", "tan", "poco", "ella", "entre", "nos", "cuando",
  "mi", "te", "tu", "sus", "ese", "esa", "estos", "estas", "unos", "unas",
]);

export function isStopWord(word: string, locale: "en" | "es"): boolean {
  const lower = word.toLowerCase();
  return EN.has(lower) || (locale === "es" && ES.has(lower));
}

export function filterStopWords(
  words: string[],
  locale: "en" | "es"
): string[] {
  return words.filter((w) => !isStopWord(w, locale));
}

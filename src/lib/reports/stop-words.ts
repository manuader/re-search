// ---------------------------------------------------------------------------
// Report Pipeline — Stop Words (EN + ES + PT + FR + DE)
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

const PT = new Set([
  "o", "a", "de", "em", "e", "que", "um", "uma", "os", "as",
  "do", "da", "dos", "das", "por", "com", "não", "nao", "se", "ao",
  "para", "como", "mas", "mais", "já", "ja", "ou", "foi", "este", "tem",
  "sem", "sobre", "também", "tambem", "me", "até", "ate", "há", "ha",
  "nos", "lhe", "muito", "ser", "está", "esta", "eu", "isso",
  "são", "sao", "era", "tudo", "ela", "entre", "quando", "seu", "sua",
]);

const FR = new Set([
  "le", "la", "de", "en", "et", "que", "un", "une", "les", "des",
  "du", "par", "avec", "ne", "pas", "se", "au", "ce", "pour", "sur",
  "comme", "mais", "plus", "ou", "est", "il", "elle", "on", "son", "sa",
  "ses", "nous", "vous", "ils", "elles", "qui", "dans", "être", "etre",
  "avoir", "fait", "sont", "été", "ete", "aussi", "très", "tres",
  "bien", "tout", "cette", "ces", "aux", "leur", "leurs", "même", "meme",
]);

const DE = new Set([
  "der", "die", "das", "und", "in", "von", "zu", "den", "mit", "ist",
  "ein", "eine", "für", "fur", "auf", "dem", "nicht", "sich", "es",
  "des", "auch", "als", "an", "aus", "aber", "wie", "hat", "noch",
  "nach", "bei", "um", "war", "wird", "sind", "kann", "nur", "oder",
  "ich", "sie", "wir", "was", "wenn", "man", "über", "uber", "so",
  "sehr", "dann", "zum", "zur", "vom", "bis", "durch", "unter",
]);

const ALL_SETS: Record<string, Set<string>> = { en: EN, es: ES, pt: PT, fr: FR, de: DE };

export function isStopWord(word: string, locale: string): boolean {
  const lower = word.toLowerCase();
  if (EN.has(lower)) return true;
  const localeSet = ALL_SETS[locale];
  return localeSet ? localeSet.has(lower) : false;
}

export function filterStopWords(words: string[], locale: string): string[] {
  return words.filter((w) => !isStopWord(w, locale));
}

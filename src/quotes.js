// Adapted from memory of Samuel Butler's public-domain 1900 prose
// translation of the Odyssey, plus a few of the poem's best-known recurring
// epithets. Wording here is reconstructed, not copied from a source file —
// swap in exact text from Project Gutenberg's edition if verbatim accuracy
// matters.
export const quotes = [
  "Tell me, Muse, of that resourceful man who wandered far and wide after sacking the sacred city of Troy.",
  "Now Dawn arose from her couch beside the lordly Tithonus, to bring light to immortals and to mortal men.",
  "The wine-dark sea rolled on beneath them as they sailed toward home.",
  "My name is Nobody; my father and mother call me Nobody, as do all the others who are my companions.",
  "There is a time for many words, and there is also a time for sleep.",
  "Nothing is sweeter than one's own country and one's own parents, however rich a home one may have in a foreign land.",
  "By day she wove at her great loom, and every night by torchlight she unwove it, waiting for her husband's return.",
  "There is nothing better in this world than that man and wife should be of one heart and mind in a house.",
  "The old hound knew his master, worn and disguised as he was, and wagged his tail before he closed his eyes in death.",
  "So long as I live, my heart will remember Ithaca, though I sail to the ends of the earth.",
];

const STORAGE_KEY = "nostos-quote-index";

// Cycles sequentially through the list, one quote per page load, persisted
// across refreshes via localStorage (falls back to a random pick if
// storage is unavailable, e.g. private browsing).
export function nextQuote() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw === null ? -1 : Number(raw);
    const index = (current + 1 + quotes.length) % quotes.length;
    localStorage.setItem(STORAGE_KEY, String(index));
    return quotes[index];
  } catch {
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
}

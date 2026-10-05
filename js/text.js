/**
 * Text normalisation helpers.
 *
 * The UI font has no glyph for accented characters, so every string that
 * reaches the DOM is transliterated before rendering.
 */

/** Removes diacritics and expands ligatures, keeping every other character. */
function deaccent(text) {
  return String(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/\u00c6/g, "AE")
    .replace(/\u00e6/g, "ae");
}

/**
 * Produces a font-safe string: no diacritics and no exotic punctuation.
 * The degree sign is kept because it is required to read a temperature.
 */
export function toAscii(text) {
  return deaccent(text).replace(/[^\x20-\x7e\u00b0]/g, "");
}

/** Lowercase, diacritic-free lookup key used to match city names. */
export function toSlug(text) {
  return deaccent(text).toLowerCase().trim();
}

/**
 * Uppercases the first letter of every word, leaving the rest untouched.
 *
 * A name is free text: `saint-germain-en-laye` is displayed
 * `Saint-Germain-En-Laye`, and a word may start after a space or a hyphen rather
 * than at the very beginning, as in `Le Locle` or `'s Gravenvoeren`. Matching the
 * separating punctuation directly therefore covers both, without the index
 * arithmetic a first-letter-only version needs.
 */
export function capitalize(text) {
  return String(text).replace(/(^|[\s'-])(\p{L})/gu, (_, before, letter) => before + letter.toLocaleUpperCase("fr"));
}

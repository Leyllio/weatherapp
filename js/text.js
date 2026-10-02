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
 * Uppercases the first letter and leaves the rest untouched.
 *
 * The city index stores names the way their postal service writes them, so some
 * start lowercase and some start with a leading article apostrophe, as in
 * `'s Gravenvoeren`. Leading punctuation is skipped so the first letter is what
 * gets capitalised, not the apostrophe before it.
 */
export function capitalize(text) {
  const value = String(text);
  const index = value.search(/\p{L}/u);
  if (index < 0) return value;
  return value.slice(0, index) + value[index].toLocaleUpperCase("fr") + value.slice(index + 1);
}

/**
 * Minimal DOM builder.
 *
 * `el` mirrors the JSX signature closely enough that view code stays readable,
 * and it transliterates every text node through `toAscii` so the UI font never
 * receives an accented character.
 */

import { toAscii } from "./text.js";

/**
 * Creates an element.
 *
 * @param {string} tag Element name.
 * @param {object} [attrs] Attributes. `class`, `dataset` and `style` are
 *   special-cased, keys starting with `on` become listeners, and
 *   `null`/`undefined`/`false` values are skipped so optional attributes stay
 *   concise.
 * @param {...(Node|string|null|undefined|false|Array)} children Child nodes or
 *   strings; nested arrays and empty values are flattened and ignored.
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(toAscii(child)));
  }

  return node;
}

/** Builds a decorative glyph as a CSS mask so it inherits the text colour. */
export function icon(name) {
  return el("span", { class: `icon icon-${name}`, "aria-hidden": "true" });
}

/** Renders an external weather pictogram, or nothing when the API omits it. */
export function weatherIcon(src, alt, size) {
  return src ? el("img", { src, alt: alt ?? "", width: size, height: size }) : null;
}

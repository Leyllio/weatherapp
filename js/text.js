/**
 * Helpers de texte partages par la couche de donnees et celle du rendu.
 */

/**
 * Enleve les diacritiques : la police du bandeau n'a pas de glyphe accentue, et
 * un caractere manquant s'affiche en carre vide. Le degre est conserve, il est
 * indispensable pour lire une temperature.
 */
export function toAscii(text) {
  return String(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7e°]/g, "");
}

/**
 * Met en majuscule la premiere lettre d'un nom, et celle de chaque particule.
 *
 * La saisie est libre : `saint-germain-en-laye` doit s'afficher
 * `Saint-Germain-En-Laye`. L'index de villes de la branche principale ecrit les
 * noms comme leur service postal, certains en minuscules et certains avec une
 * apostrophe en tete, comme `'s Gravenvoeren` : la regex saute donc la
 * ponctuation initiale et met en majuscule la lettre qui suit.
 */
export function capitalize(text) {
  return String(text).replace(/(^|[\s'-])(\p{L})/gu, (_, before, letter) => before + letter.toLocaleUpperCase("fr"));
}
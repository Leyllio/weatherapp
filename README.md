# WeatherApp - SPA a la main

Exercice « Une Single-Page Application à la main ». Une page HTML, du CSS, des modules ES, aucun framework, aucune étape de build.

Le squelette imposé est respected : un champ de saisie et un bouton `afficher` dans `#menu`, et un conteneur `#data` que l'application remplit avec les données téléchargées.

## Fonctionnement

Le bouton `afficher` (ou la touche Entree) demande le flux JSON de [prevision-meteo.ch](https://www.prevision-meteo.ch) pour le nom saisi, puis peint trois sections dans `#data` : conditions actuelles, cinq jours, et les 24 heures du jour. Un clic sur la carte fait la même chose pour les coordonnées cliquées, et le lieu est nommé via Nominatim.

## Données

Une seule URL, qui accepte une ville ou un point :

```
https://www.prevision-meteo.ch/services/json/<ville>
https://www.prevision-meteo.ch/services/json/lat=46.99lng=6.93
```

La ville est normalisée en minuscules sans accents ni espaces (`Saint-Germain-en-Laye` devient `saint-germain-en-laye`). Le service repond en `200` avec un champ `errors` quand la cible est inconnue, ce qui est le seul signe fiable d'echec : `js/weather.js` le verifie avant de convertir la reponse.

Le fond de carte vient d'OpenStreetMap, et le nom des points cliques de l'API de geocodage inverse Nominatim, qui impose un identifiant et refuse les appels repetes. Les deux sont optionnels : sans eux l'application affiche encore la meteo du point.

## Fichiers

| Chemin | Role |
| --- | --- |
| `index.html` | Squelette impose et bandeau |
| `css/style.css` | Charte graphique : jetons, themes, composants, adaptations |
| `js/weather.js` | Flux JSON, normalisation des donnees, mapping des icones |
| `js/view.js` | Rendu des sections dans `#data` |
| `js/map.js` | Carte Leaflet, marqueur, cadrage |
| `js/main.js` | Controleur : evenements, chargement, nommage des points |
| `js/theme.js` | Theme jour/nuit, memorise |
| `js/rain.js` | Pluie sur le mot-symbole, au survol seulement |

## Lancer

Les modules ES demandent HTTP, pas `file://` :

```bash
python3 -m http.server 8000
```

Puis <http://localhost:8000>.

## Note

La police du bandeau n'a pas de glyphe accentue : `js/view.js` retire les diacritiques de tout texte affiche, le signe degre etant conserve pour lire une temperature.
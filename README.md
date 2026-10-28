# Sabina Karimova — Portfolio

Portfolio personnel en ligne : **https://sabinakarimova.com**

Étudiante Pré-MSc Pro à EPITECH Nantes, à la recherche d'une alternance IT (contrat d'apprentissage) à partir de janvier 2027.

## Pages

| Page | Fichier | Contenu |
|---|---|---|
| Portfolio | `index.html` | page principale : présentation, projets, compétences, progression, CV, contact (menu qui défile vers chaque section) |
| CV numérique | `cv.html` | CV interactif bilingue avec globe 3D |

Menu : **Accueil**, **Projets**, **Parcours** (CV, compétences, « Ce que j'ai appris cette année »), **Contact** (coordonnées et formulaire). Chaque entrée défile vers sa section.

## Structure du dossier

```
index.html  cv.html
site.css        style de la page principale
site.js         langue FR/EN, menu mobile, menu actif, fond étoilé, Terre 3D, compteurs
projects.js     fenêtre des jeux et visionneuse des captures
contact.js      formulaire de contact (lien mailto:)
games.js        jeu Hangman
dodge.js        jeu Dodge Game
style.css / script.js   style et script du CV numérique (cv.html)
robots.txt  sitemap.xml  favicon.svg
assets/         images, aperçus des projets, textures de la Terre, CV en PDF
```

## Projets présentés

Dans l'ordre de la page « Projets » :

1. **Portfolio** — ce site (projet EPITECH, en ligne)
2. **JobBoard** — plateforme d'offres d'alternance, de stage et d'emploi junior, projet d'équipe EPITECH (PHP · MariaDB · Git/GitHub)
3. **CV numérique** — CV sous forme de site avec globe 3D
4. **Dodge Game** — shoot'em up spatial en 3D (v1 Python/Pygame → v2 JavaScript/Three.js)
5. **Hangman** — jeu du pendu avec photo pixelisée (v1 Python/Pygame → v2 JavaScript/Canvas)

## Technologies

HTML · CSS (Grid, Flexbox) · JavaScript (sans framework) · Three.js / WebGL · Canvas

## Fonctionnalités

- Menu qui défile en douceur vers chaque section, avec la section active mise en évidence, et menu « hamburger » sur mobile (clavier : Tab, Entrée, Échap)
- Bilingue français / anglais (textes, placeholders et textes alternatifs des images)
- Responsive : ordinateur, tablette et mobile
- Accessibilité : un seul `h1`, `alt` sur toutes les images, libellés de formulaire, focus visible, `prefers-reduced-motion` respecté
- Référencement : `title` et description par page, lien canonique, Open Graph, `robots.txt`, `sitemap.xml`
- Formulaire de contact sans serveur : il ouvre le client e-mail du visiteur avec le message prérempli
- Terre 3D interactive (à faire tourner à la souris ou au doigt)

## Lancer en local

Ouvrir le dossier avec un petit serveur local, par exemple :

```bash
python -m http.server 8000
```

puis aller sur http://localhost:8000

## Publication

Le site est statique : il n'y a rien à compiler, il suffit de publier le dossier tel quel. La publication est **automatique** : chaque `git push` sur la branche `main` met le site à jour, sans étape manuelle.

- **GitHub Pages** : le workflow `.github/workflows/pages.yml` déploie le dépôt à chaque push (réglage à faire une fois : *Settings → Pages → Source : GitHub Actions*).
- **Netlify** (domaine sabinakarimova.com) : le site Netlify est relié au dépôt GitHub (*Add new site → Import an existing project*). Le fichier `netlify.toml` indique le dossier à publier ; chaque push déclenche un déploiement.

Flux de travail : une modification = un commit avec un message explicite, puis `git push`.

## Images

- `assets/img/sabina-portrait.webp` : portrait de la section CV
- `assets/games/previews/` : captures des projets (dont `portfolio.webp`, aussi utilisée pour le partage Open Graph)

## Crédits

Sons : Kenney (CC0) · Textures de la Terre : NASA · Photos : Unsplash

## Contact

- LinkedIn : https://www.linkedin.com/in/sabina-karimova-633447382
- Email : sabina.karimova@epitech.eu

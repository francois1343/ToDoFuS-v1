# Données ToDofus

Les composants lisent les données par l’intermédiaire de `data-loader.js`. Les sources sont séparées par thème :

- `rush-starter.json` : parcours Rush Starter ;
- `zones.json` : zones ;
- `parcours.json` : parcours transversaux ;
- `succes.json` : succès des Dofus ;
- `quetes.json` : quêtes détaillées des succès ;
- `dofus.json` : métadonnées, prérequis et parties des Dofus ;
- `artisanat.json` : métiers de récolte, fabrication et forgemagie ;
- `elevage.json` : élevage et générations.

Le chargeur fusionne ces fichiers avant validation afin de conserver le format interne actuel.

## Objectif JSON générique

Un objectif est placé dans le tableau `objectives` de sa zone, route, quête ou génération :

```json
{
  "id": "identifiant-stable",
  "name": "Nom affiché",
  "type": "dungeon",
  "minLevel": 20,
  "maxLevel": 40,
  "tags": ["duo", "prudent"],
  "order": 10,
  "description": "Texte facultatif"
}
```

Valeurs de `type` prévues : `dungeon`, `quest`, `monster`, `objective`, `achievement`, `dofus`, `anomaly`, `forgotten`, `breeding`.

Les tags reconnus peuvent notamment contenir `duo`, `prudent`, `starter`, `companion`, `world-tour`, `gladiatrool` et `score-tutu`. De nouveaux tags restent acceptés sans changement de schéma.

Une route peut contenir directement des `objectives` ou les répartir dans un tableau `groups`. Chaque groupe possède son propre `id`, `name`, `order`, éventuellement une `reward`, puis son tableau `objectives`. C’est le format utilisé par les cinq paliers du Donjon Rusher.

Les IDs sont des slugs immuables et uniques dans leur module. Renommer un libellé ne doit jamais modifier son ID, car la progression locale utilise la clé `<module>:<id>`.

## CSV équivalent

Le chargeur expose `ToDofusData.parseCsv()` et `objectiveFromCsv()`. Une ligne CSV représente un objectif :

```csv
dataset,parentId,id,name,type,minLevel,maxLevel,tags,order,description
zones,incarnam,exemple-stable,Nom affiché,dungeon,10,20,duo|prudent,10,Texte facultatif
```

- `dataset` cible la collection (`zones`, `routes`, `dofus` ou `breeding`).
- `parentId` désigne la zone, route, quête ou génération parente.
- `tags` utilise `|` comme séparateur interne.
- `minLevel`, `maxLevel`, `order` sont numériques.
- `description` et les niveaux peuvent rester vides.

## Progression des métiers

Les métiers utilisent une mesure numérique et non une liste de cases :

```json
{
  "id": "alchimiste",
  "name": "Alchimiste",
  "order": 10,
  "progression": {
    "kind": "level",
    "min": 0,
    "max": 200,
    "current": 0,
    "target": 200
  }
}
```

Le niveau atteint est une donnée utilisateur stockée localement ; il ne doit pas être ajouté au fichier source.

## Élevage

Chaque entrée de `generations` accepte indépendamment `raceIds`, `scrolls` et `objectives`. Ajouter une génération consiste uniquement à ajouter un nouvel objet avec un ID stable et un ordre.

## Parcours Dofus

Chaque Dofus référence un parcours avec `progression.trackId`, son ordre et ses prérequis :

```json
{
  "trackId": "main-dofus",
  "order": 20,
  "requiredIds": ["dofus-argente"]
}
```

Une liste `objectives` vide produit uniquement l’objectif de haut niveau « Obtenir le Dofus ». Dès que des étapes sont ajoutées, elles remplacent automatiquement cet objectif synthétique.

Pour les parcours détaillés, `parts` organise les succès dans des parties. Chaque
identifiant de `parts[].successes` référence un objectif de succès présent dans
`objectives`; ses entrées `quests` sont ensuite les quêtes individuelles. Une
quête peut contenir `todoList`, `prerequisites` et `itemsRequired`.

Le format Dofus v3 accepte aussi `title` à la place de `name` et `summary` à la
place de `description` pour les objectifs. Les tags sont normalisés en minuscules
par le chargeur afin que `Duo` et `duo` produisent le même filtre. Un objectif de
type `achievement` est également accepté pour les succès détaillés.

## Validation au chargement

Le chargeur vérifie automatiquement la syntaxe JSON, les IDs d’objectifs
dupliqués, les plages de niveaux, les prérequis de Dofus et les types
d’objectifs reconnus. Une erreur bloque le rendu avec un message explicite,
afin qu’une faute dans un fichier ne masque pas silencieusement un module.

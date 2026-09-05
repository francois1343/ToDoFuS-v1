/* ================================================================
   Todoofus — architecture modulaire alimentée par JSON / CSV
   ================================================================ */
"use strict";

const storageKey = "dofus-progression-v3";
const previousStorageKey = "dofus-progression-v2";
const legacyStorageKey = "dofus-boucliers-todo-v1";
const legacyPvmIds = [
  "cour-bouftou-royal", "cache-kankreblath", "chateau-wa-wabbit",
  "cimetiere-mastodontes", "bateau-chouque", "theatre-dramak",
  "caverne-koulosse", "bambusaie-damadrya", "repaire-crocabulia",
  "repaire-skeunk", "atelier-tanukoui-san", "clairiere-chene-mou",
  "dojo-du-vent-aerdala", "fabrique-foux-artifice",
  "tombe-shogun-tofugawa", "megalithe-fraktale",
  "repaire-sphincter-cell", "plateau-ush", "canopee-kimbo",
  "grotte-bworker", "trone-cour-sombre", "palais-dantinea",
  "oeil-vortex", "defi-chaloeil", "chambre-tal-kasha",
];

const typeLabels = {
  dungeon: "Donjon",
  quest: "Quête",
  monster: "Monstre",
  objective: "Objectif",
  dofus: "Dofus",
  anomaly: "Anomalie",
  forgotten: "Fratrie",
  profession: "Métier",
  gathering: "Récolte",
  crafting: "Fabrication",
  mage: "Forgemagie",
  breeding: "Élevage",
  scroll: "Parchemin",
  achievement: "Succès",
  activity: "Activité",
  duo: "Duo",
  prudent: "Prudent",
  starter: "Rush Starter",
  companion: "Compagnons",
  "world-tour": "Tour du Monde",
  gladiatrool: "Gladiatrool",
  "score-tutu": "Score Tutu",
};

const moduleBlueprints = {
  pvm: {
    id: "pvm",
    label: "PvM / Donjons / Succès",
    shortLabel: "PvM",
    icon: "shield",
    eyebrow: "Exploration par zone",
    title: "Zones et parcours",
    progressUnit: "objectifs terminés",
    searchPlaceholder: "Rechercher une zone ou un objectif…",
    categories: ["dungeon", "quest", "monster", "objective"],
    notice: "Les cartes viennent des fichiers zones.json, rush-starter.json et parcours.json ; leurs objectifs peuvent être ajoutés progressivement.",
  },
  lore: {
    id: "lore",
    label: "Quêtes",
    shortLabel: "Quêtes",
    icon: "map",
    eyebrow: "Progression séquentielle",
    title: "Dofus et récits",
    progressUnit: "parcours terminés",
    searchPlaceholder: "Rechercher un Dofus ou une quête…",
    categories: ["dofus", "quest", "anomaly", "forgotten"],
    notice: "Les prérequis de dofus.json pilotent automatiquement l’ordre et le verrouillage des parcours.",
  },
  artisanat: {
    id: "artisanat",
    label: "Artisanat / Élevage",
    shortLabel: "Artisanat",
    icon: "spark",
    eyebrow: "Métiers et élevage",
    title: "Progressions artisanales",
    progressUnit: "parcours finalisés",
    searchPlaceholder: "Rechercher un métier ou une génération…",
    categories: ["gathering", "crafting", "mage", "breeding", "scroll"],
    notice: "Les niveaux sont personnels et restent dans le navigateur ; les définitions viennent uniquement des JSON.",
  },
};

const elements = {
  tiers: document.getElementById("tiers"),
  moduleContent: document.getElementById("moduleContent"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyText: document.getElementById("emptyText"),
  resultCount: document.getElementById("resultCount"),
  moduleNotice: document.getElementById("moduleNotice"),
  searchInput: document.getElementById("searchInput"),
  objectiveSearchInput: document.getElementById("objectiveSearchInput"),
  searchLabel: document.getElementById("searchLabel"),
  levelFilter: document.getElementById("levelFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  tagFilters: document.getElementById("tagFilters"),
  zoneFilter: document.getElementById("zoneFilter"),
  zoneFilterField: document.getElementById("zoneFilterField"),
  resetFilters: document.getElementById("resetFilters"),
  expandAll: document.getElementById("expandAll"),
  collapseAll: document.getElementById("collapseAll"),
  hideCompleted: document.getElementById("hideCompleted"),
  hideCompletedLabel: document.getElementById("hideCompletedLabel"),
  exportSave: document.getElementById("exportSave"),
  importSave: document.getElementById("importSave"),
  importFile: document.getElementById("importFile"),
  saveStatus: document.getElementById("saveStatus"),
  toggleTheme: document.getElementById("toggleTheme"),
  themeLabel: document.getElementById("themeLabel"),
  progressEyebrow: document.getElementById("progressEyebrow"),
  progressText: document.getElementById("progressText"),
  progressUnit: document.getElementById("progressUnit"),
  progressPercent: document.getElementById("progressPercent"),
  progressFill: document.getElementById("progressFill"),
  progressBar: document.getElementById("progressBar"),
  progressMessage: document.getElementById("progressMessage"),
  questEyebrow: document.getElementById("questEyebrow"),
  questTitle: document.getElementById("quest-title"),
  checkAll: document.getElementById("checkAll"),
  checkAllLabel: document.getElementById("checkAllLabel"),
  openReset: document.getElementById("openReset"),
  resetLabel: document.getElementById("resetLabel"),
  resetDialog: document.getElementById("resetDialog"),
  dialogTitle: document.getElementById("dialogTitle"),
  resetDialogText: document.getElementById("resetDialogText"),
  toast: document.getElementById("toast"),
};

let modules = [];
let activeModuleId = "pvm";
let activeStatus = "all";
let activeCategory = "all";
let activeTags = [];
let activeLevel = "all";
let activeZone = "all";
let searchTerm = "";
let objectiveSearchTerm = "";
let hideCompleted = false;
let hiddenSections = new Set();
let toastTimer;
const openGroupIds = new Set();
const filterState = {};
const objectivePages = new Map();

function storageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(storageItem(key) || "null");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  try {
    state.lastSavedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(state));
    updateSaveStatus();
    return true;
  } catch {
    return false;
  }
}

function loadState() {
  const loaded = readJson(storageKey, null);
  const next = {
    objectives: loaded?.objectives || {},
    metrics: loaded?.metrics || {},
    migrations: loaded?.migrations || {},
    filters: loaded?.filters || {},
    openGroups: loaded?.openGroups || [],
    lastSavedAt: loaded?.lastSavedAt || null,
    theme: loaded?.theme === "dark" ? "dark" : "light",
  };
  if (!next.migrations.progressionV2) {
    Object.entries(readJson(previousStorageKey, {})).forEach(([id, completed]) => {
      if (completed) next.objectives[id] = true;
    });
    next.migrations.progressionV2 = true;
  }
  if (!next.migrations.boucliersV1) {
    Object.entries(readJson(legacyStorageKey, {})).forEach(([oldId, completed]) => {
      if (!completed) return;
      const match = /^t(\d+)-d(\d+)$/.exec(oldId);
      if (!match) return;
      const id = legacyPvmIds[Number(match[1]) * 5 + Number(match[2])];
      if (id) next.objectives[`pvm:${id}`] = true;
    });
    next.migrations.boucliersV1 = true;
  }
  return next;
}

let state = loadState();
Object.assign(filterState, state.filters);
state.openGroups.forEach((id) => openGroupIds.add(id));
document.documentElement.dataset.theme = state.theme;
applyTheme(state.theme);
saveState();

const icon = (name) =>
  `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
const asArray = (value) => (Array.isArray(value) ? value : []);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const numberOrNull = (value) =>
  Number.isFinite(Number(value)) && value !== "" && value !== null
    ? Number(value)
    : null;

function normalizeObjective(raw, parentId) {
  const name = typeof raw?.name === "string" ? raw.name : raw?.title;
  if (!raw || typeof raw.id !== "string" || typeof name !== "string")
    return null;
  const base = {
    id: raw.id,
    name,
    type: raw.type || "objective",
    parentId,
    minLevel: numberOrNull(raw.minLevel ?? raw.level),
    maxLevel: numberOrNull(raw.maxLevel ?? raw.level),
    tags: asArray(raw.tags)
      .filter((tag) => typeof tag === "string")
      .map((tag) => normalizeSearch(tag).replace(/\s+/g, "-")),
    order: Number(raw.order) || 0,
    description:
      typeof raw.description === "string"
        ? raw.description
        : typeof raw.summary === "string"
          ? raw.summary
          : "",
    successId: raw.id,
    partId: raw.partId || null,
    partName: raw.partName || "",
    successName: name,
    questObjectives: [],
    itemsRequired: [],
    prerequisites: [],
  };
  if (!asArray(raw.quests).length) return base;
  return asArray(raw.quests)
    .filter((quest) => typeof quest?.id === "string" && typeof quest?.name === "string")
    .map((quest, index) => ({
      ...base,
      id: quest.id,
      name: quest.name,
      type: "quest",
      minLevel: numberOrNull(quest.level ?? base.minLevel),
      maxLevel: numberOrNull(quest.level ?? base.maxLevel),
      order: (Number(raw.order) || 0) * 100 + index + 1,
      tags: [...base.tags, raw.id],
      description: `${name}${quest.npc ? ` · PNJ : ${quest.npc}` : ""}${quest.pos ? ` · ${quest.pos}` : ""}`,
      questObjectives: asArray(quest.todoList),
      itemsRequired: asArray(quest.itemsRequired),
      prerequisites: asArray(quest.prerequisites),
    }));
}

function makeGroup(raw, additions = {}) {
  return {
    id: raw.id,
    name: raw.name,
    order: Number(raw.order) || 0,
    description: typeof raw.description === "string" ? raw.description : "",
    objectives: asArray(raw.objectives)
      .flatMap((objective) => normalizeObjective(objective, raw.id) || [])
      .sort(byOrder),
    tags: asArray(raw.tags),
    itemsRequired: asArray(raw.itemsRequired),
    supportedTypes: asArray(raw.supportedTypes),
    levelRange: raw.levelRange || null,
    ...additions,
  };
}

function dofusGroup(raw) {
  const progression = raw.progression || {};
  const suppliedObjectives = asArray(raw.objectives);
  const partItemsById = Object.fromEntries(
    asArray(raw.parts).map((part) => [part.id, asArray(part.itemsRequired)]),
  );
  if (!Object.keys(partItemsById).length && asArray(raw.itemsRequired).length) {
    partItemsById[raw.id] = asArray(raw.itemsRequired);
  }
  const partBySuccess = new Map(
    asArray(raw.parts).flatMap((part) =>
      asArray(part.successes).map((successId) => [
        successId,
        { id: part.id, name: part.name, itemsRequired: asArray(part.itemsRequired) },
      ]),
    ),
  );
  const structuredObjectives = suppliedObjectives.map((success, index) => {
    const part = partBySuccess.get(success.id);
    const orderedSuccess = {
      ...success,
      order: Number(success.order) || index + 1,
    };
    return part
      ? {
          ...orderedSuccess,
          partId: part.id,
          partName: part.name,
          partItemsRequired: part.itemsRequired,
        }
      : orderedSuccess;
  });
  const objectives = suppliedObjectives.length
    ? structuredObjectives
    : [
        {
          id: raw.id,
          name: `Obtenir ${raw.name}`,
          type: "dofus",
          minLevel: raw.level,
          maxLevel: raw.level,
          tags: [raw.acquisition || "quest", raw.category].filter(Boolean),
          order: 0,
        },
      ];
  return makeGroup(
    { ...raw, order: progression.order ?? raw.order, objectives },
    {
      kind: "dofus",
      trackId: progression.trackId || null,
      requiredIds: asArray(progression.requiredIds),
      categoryKeys: ["dofus", raw.acquisition || "quest", raw.category].filter(Boolean),
      levelRange: { min: raw.level || null, max: raw.level || null },
      partItemsById,
    },
  );
}

function buildModules(data) {
  const zones = asArray(data.zones?.zones)
    .map((zone) =>
      makeGroup(zone, {
        kind: "zone",
        categoryKeys: asArray(zone.supportedTypes).length
          ? asArray(zone.supportedTypes)
          : ["dungeon", "quest", "monster", "objective"],
      }),
    )
    .sort(byOrder);
  const routeSources = asArray(data.routes?.routes);
  const routeSections = routeSources
    .filter((route) => asArray(route.groups).length)
    .map((route) => ({
      id: `route-${route.id}`,
      title: route.name,
      description: route.description || "",
      groups: asArray(route.groups)
        .map((group) =>
          makeGroup(
            {
              ...group,
              description: group.reward || group.description || "",
            },
            {
              kind: "route-tier",
              categoryKeys: ["dungeon", ...asArray(route.tags)],
              routeId: route.id,
            },
          ),
        )
        .sort(byOrder),
    }));
  const routes = routeSources
    .filter((route) => !asArray(route.groups).length)
    .map((route) =>
      makeGroup(route, {
        kind: "route",
        categoryKeys: [route.type, ...asArray(route.tags)].filter(Boolean),
      }),
    )
    .sort(byOrder);

  const allDofus = asArray(data.dofus?.dofus || data.dofus?.tracks)
    .filter((entry) => entry?.id && entry?.name)
    .map(dofusGroup);
  const trackDefinitions = asArray(data.dofus?.tracks).filter(
    (entry) => entry?.type && entry?.id,
  );
  const dofusSections = trackDefinitions.map((track) => ({
    id: track.id,
    title: track.name,
    description: track.description || "",
    sequential: track.type === "linear",
    groups: allDofus.filter((entry) => entry.trackId === track.id).sort(byOrder),
  }));
  const untrackedDofus = allDofus.filter(
    (entry) => !trackDefinitions.some((track) => track.id === entry.trackId),
  );
  if (untrackedDofus.length)
    dofusSections.push({
      id: "other-dofus",
      title: "Autres Dofus",
      groups: untrackedDofus.sort((a, b) => (a.levelRange?.min || 0) - (b.levelRange?.min || 0)),
    });
  const loreCategories = asArray(data.dofus?.categories)
    .map((category) =>
      makeGroup(category, {
        kind: category.id === "anomalies-temporelles" ? "anomaly" : "forgotten",
        categoryKeys: [
          category.id === "anomalies-temporelles" ? "anomaly" : "forgotten",
          "quest",
        ],
      }),
    )
    .sort(byOrder);
  if (loreCategories.length)
    dofusSections.push({ id: "lore-categories", title: "Autres récits", groups: loreCategories });

  const professions = asArray(data.professions?.professions)
    .filter((profession) => profession?.id && profession?.name)
    .map((profession) => {
      const progression = profession.progression || profession.progress || {};
      return makeGroup(profession, {
        kind: "profession",
        categoryKeys: ["profession", profession.type, ...asArray(profession.tags)].filter(Boolean),
        metric: {
          min: Number(progression.min) || 0,
          max: Number(progression.max) || 200,
          initial: Number(progression.current) || 0,
          target: Number(progression.target) || Number(progression.max) || 200,
        },
      });
    })
    .sort(byOrder);
  const professionCategories = asArray(data.professions?.categories).filter(
    (category) => category.id !== "breeding",
  );
  const professionSections = professionCategories.map((category) => ({
    id: category.id,
    title: category.name,
    groups: professions.filter((profession) =>
      profession.categoryKeys.includes(category.id),
    ),
  }));
  const uncategorized = professions.filter(
    (profession) =>
      !professionCategories.some((category) =>
        profession.categoryKeys.includes(category.id),
      ),
  );
  if (uncategorized.length)
    professionSections.push({ id: "other-professions", title: "Autres métiers", groups: uncategorized });

  const generations = asArray(data.breeding?.generations)
    .map((generation) =>
      makeGroup(generation, {
        kind: "breeding",
        categoryKeys: ["breeding", "scroll"],
        raceIds: asArray(generation.raceIds || generation.races),
        scrolls: asArray(generation.scrolls),
      }),
    )
    .sort(byOrder);
  if (generations.length)
    professionSections.push({ id: "breeding", title: "Élevage", groups: generations });

  return [
    {
      ...moduleBlueprints.pvm,
      sections: [
        ...routeSections,
        { id: "zones", title: "Zones", groups: zones },
        { id: "routes", title: "Parcours transversaux", groups: routes },
      ],
    },
    { ...moduleBlueprints.lore, sections: dofusSections },
    { ...moduleBlueprints.artisanat, sections: professionSections },
  ];
}

const currentModule = () =>
  modules.find((module) => module.id === activeModuleId);
const moduleGroups = (module) =>
  module.sections.flatMap((section) => section.groups);
const objectiveStateId = (module, objective) => `${module.id}:${objective.id}`;
const isObjectiveDone = (module, objective) =>
  Boolean(state.objectives[objectiveStateId(module, objective)]);
const metricStateId = (group) => `artisanat:${group.id}`;
const itemStateId = (module, partKey, name) =>
  `${module.id}:item:${partKey}:${normalizeSearch(name)}`;
const metricValue = (group) => {
  const saved = Number(state.metrics[metricStateId(group)]);
  const value = Number.isFinite(saved) ? saved : group.metric.initial;
  return Math.min(group.metric.max, Math.max(group.metric.min, value));
};
const metricRatio = (group) => {
  const span = group.metric.target - group.metric.min;
  const ratio = span ? (metricValue(group) - group.metric.min) / span : 1;
  return Math.min(1, Math.max(0, ratio));
};

function groupStats(module, group) {
  if (group.metric) {
    const current = metricValue(group);
    return {
      completed: current >= group.metric.target ? 1 : 0,
      total: 1,
      percent: Math.round(metricRatio(group) * 100),
      label: `Niveau ${current} / ${group.metric.target}`,
    };
  }
  const total = group.objectives.length;
  const completed = group.objectives.filter((objective) =>
    isObjectiveDone(module, objective),
  ).length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    label: total ? `${completed} / ${total}` : "Contenu à venir",
  };
}

function moduleStats(module) {
  const groups = moduleGroups(module);
  const objectives = groups.flatMap((group) => group.objectives);
  const metrics = groups.filter((group) => group.metric);
  const completedObjectives = objectives.filter((objective) =>
    isObjectiveDone(module, objective),
  ).length;
  const completedMetrics = metrics.filter(
    (group) => metricValue(group) >= group.metric.target,
  ).length;
  const total = objectives.length + metrics.length;
  const completed = completedObjectives + completedMetrics;
  const progressUnits =
    completedObjectives +
    metrics.reduce(
      (sum, group) => sum + metricRatio(group),
      0,
    );
  return {
    completed,
    total,
    percent: total ? Math.round((progressUnits / total) * 100) : 0,
  };
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(
    () => elements.toast.classList.remove("is-visible"),
    2600,
  );
}

function updateSaveStatus() {
  if (!elements.saveStatus) return;
  if (!state.lastSavedAt) {
    elements.saveStatus.textContent = "Aucune sauvegarde locale enregistrée.";
    return;
  }
  const date = new Date(state.lastSavedAt);
  elements.saveStatus.textContent = Number.isNaN(date.getTime())
    ? "Sauvegarde locale enregistrée."
    : `Dernière sauvegarde locale : ${date.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })}`;
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  elements.themeLabel.textContent =
    state.theme === "dark" ? "Désactiver le cuir sombre" : "Activer le cuir sombre";
}

function humanize(value) {
  return (
    typeLabels[value] ||
    String(value || "")
      .replace(/-/g, " ")
      .replace(/^./, (character) => character.toLocaleUpperCase("fr"))
  );
}

function badge(value, subtle = false) {
  return `<span class="objective-badge${subtle ? " is-subtle" : ""}">${escapeHtml(humanize(value))}</span>`;
}

function selectedLevelRange() {
  if (activeLevel === "all") return null;
  const [min, max] = activeLevel.split("-").map(Number);
  return { min, max };
}

function rangeMatches(item, fallbackRange = null) {
  const selected = selectedLevelRange();
  if (!selected) return true;
  const min = numberOrNull(item.minLevel ?? item.levelRange?.min ?? fallbackRange?.min);
  const max = numberOrNull(item.maxLevel ?? item.levelRange?.max ?? fallbackRange?.max);
  if (min === null && max === null) return true;
  return (max ?? 200) >= selected.min && (min ?? 1) <= selected.max;
}

function groupSearchMatches(group) {
  if (!searchTerm) return true;
  return normalizeSearch(
    `${group.name} ${group.description} ${group.tags.join(" ")}`,
  ).includes(searchTerm);
}

function groupCategoryMatches(group) {
  if (activeCategory === "all") return true;
  return asArray(group.categoryKeys).includes(activeCategory);
}

function groupTagMatches(group) {
  if (!activeTags.length) return true;
  return activeTags.every(
    (tag) =>
      asArray(group.tags).includes(tag) ||
      group.objectives.some((objective) => asArray(objective.tags).includes(tag)),
  );
}

function groupZoneMatches(group) {
  return activeZone === "all" || group.kind !== "zone" || group.id === activeZone;
}

function objectiveMatches(module, group, objective) {
  const searchMatches =
    groupSearchMatches(group) ||
    normalizeSearch(
      `${objective.name} ${objective.description} ${objective.type} ${objective.tags.join(" ")}`,
    ).includes(searchTerm);
  const objectiveSearchMatches =
    !objectiveSearchTerm ||
    normalizeSearch(
      `${objective.name} ${objective.description} ${objective.type} ${objective.tags.join(" ")}`,
    ).includes(objectiveSearchTerm);
  const categories = [
    objective.type,
    ...objective.tags,
    ...(group.kind === "zone" ? [] : asArray(group.categoryKeys)),
  ];
  const categoryMatches =
    activeCategory === "all" || categories.includes(activeCategory);
  const levelMatches = rangeMatches(objective, group.levelRange);
  const zoneMatches = groupZoneMatches(group);
  const tagMatches = activeTags.every(
    (tag) => objective.tags.includes(tag) || group.tags.includes(tag),
  );
  const completed = isObjectiveDone(module, objective);
  const statusMatches =
    activeStatus === "all" ||
    (activeStatus === "done" ? completed : !completed);
  return searchMatches && objectiveSearchMatches && categoryMatches && tagMatches && levelMatches && zoneMatches && statusMatches;
}

function filteredObjectives(module, group) {
  return group.objectives.filter((objective) =>
    objectiveMatches(module, group, objective),
  );
}

function groupVisible(module, group, objectives) {
  const stats = groupStats(module, group);
  if (hideCompleted && stats.total > 0 && stats.completed === stats.total) {
    return false;
  }
  if (group.objectives.length) {
    return objectives.length > 0;
  }
  const metricDone = group.metric
    ? metricValue(group) >= group.metric.target
    : false;
  const statusMatches = group.metric
    ? activeStatus === "all" ||
      (activeStatus === "done" ? metricDone : !metricDone)
    : activeStatus === "all";
  return (
    groupSearchMatches(group) &&
    groupCategoryMatches(group) &&
    groupTagMatches(group) &&
    rangeMatches(group) &&
    groupZoneMatches(group) &&
    statusMatches
  );
}

function groupLocked(module, group) {
  if (!group.requiredIds?.length) return false;
  const groups = moduleGroups(module);
  return group.requiredIds.some((requiredId) => {
    const required = groups.find((candidate) => candidate.id === requiredId);
    if (!required) return false;
    const stats = groupStats(module, required);
    return stats.total > 0 && stats.completed < stats.total;
  });
}

function groupBadges(group) {
  const values = [];
  if (group.kind === "zone") values.push("dungeon", "quest", "monster");
  else if (group.kind === "dofus") values.push("dofus");
  else if (group.kind === "profession")
    values.push(group.categoryKeys.find((key) => ["gathering", "crafting", "mage"].includes(key)) || "profession");
  else if (group.kind === "breeding") values.push("breeding", "scroll");
  else values.push(...group.categoryKeys);
  if (group.levelRange?.min || group.levelRange?.max) {
    const min = group.levelRange.min ?? 1;
    const max = group.levelRange.max ?? 200;
    values.push(min === max ? `Niv. ${min}` : `Niv. ${min}–${max}`);
  }
  return [...new Set(values.filter(Boolean))]
    .slice(0, 5)
    .map((value) => badge(value, !typeLabels[value]))
    .join("");
}

function renderObjective(module, group, objective, locked) {
  const checked = isObjectiveDone(module, objective);
  const domId = `${module.id}-${objective.id}`;
  const badges = [objective.type, ...objective.tags]
    .filter(Boolean)
    .map((value) => badge(value))
    .join("");
  const level =
    objective.minLevel || objective.maxLevel
      ? `<span>${icon("spark")}Niveau ${objective.minLevel ?? 1}${objective.maxLevel && objective.maxLevel !== objective.minLevel ? `–${objective.maxLevel}` : ""}</span>`
      : "";
  const description = objective.description
    ? `<span class="task-description">${escapeHtml(objective.description)}</span>`
    : "";
  const details = [
    ...objective.questObjectives.map((item) => item.label || item.name || ""),
    ...objective.prerequisites.map((item) => typeof item === "string" ? item : item.label || item.name || ""),
  ].filter(Boolean);
  const detailList = details.length
    ? `<ul class="quest-details">${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
    : "";

  return `<label class="task${checked ? " done" : ""}" for="${domId}">
    <input id="${domId}" type="checkbox" data-objective="${escapeHtml(objective.id)}" ${checked ? "checked" : ""}>
    <span class="task-main">
      <span class="task-name">${escapeHtml(objective.name)}</span>
      ${description}
      ${detailList}
      <span class="task-meta">${level}<span class="objective-badges">${badges}</span></span>
    </span>
  </label>`;
}

function renderSuccessSection(module, group, successId, objectives, locked) {
  const first = objectives[0];
  return `<details class="success-accordion" data-success="${escapeHtml(`${module.id}:${group.id}:${successId}`)}">
    <summary class="success-heading">
      <span>${escapeHtml(first.successName || successId)}</span>
    </summary>
    <div class="success-content">
      <div class="success-quests">
        ${objectives.map((objective) => renderObjective(module, group, objective, locked)).join("")}
      </div>
    </div>
  </details>`;
}

function renderPartHeading(partName) {
  return `<h3 class="quest-part-heading">${escapeHtml(partName || "Partie")}</h3>`;
}

function captureOpenQuestDetails() {
  return [...elements.tiers.querySelectorAll("details[open]")]
    .map((details) => {
      if (details.dataset.group) return `group:${details.dataset.group}`;
      if (details.dataset.part) return `part:${details.dataset.part}`;
      if (details.dataset.success) return `success:${details.dataset.success}`;
      return "";
    })
    .filter(Boolean);
}

function restoreOpenQuestDetails(openDetails) {
  openDetails.forEach((key) => {
    const [kind, ...parts] = key.split(":");
    const value = parts.join(":");
    const selector = kind === "group"
      ? `[data-group="${CSS.escape(value)}"]`
      : kind === "part"
        ? `[data-part="${CSS.escape(value)}"]`
        : `[data-success="${CSS.escape(value)}"]`;
    const details = elements.tiers.querySelector(selector);
    if (details) details.open = true;
  });
}

function renderPartItemsPanel(module, group) {
  const partId = Object.keys(group.partItemsById || {})[0];
  const items = asArray(group.partItemsById?.[partId]);
  if (!items.length) return { button: "", panel: "" };
  const partKey = `${module.id}:${group.id}:part:${partId}`;
  const itemList = `<ul class="success-items">${items.map((item) => {
    const itemId = itemStateId(module, partKey, item.name);
    return `<li class="${state.objectives[itemId] ? "item-done" : ""}">
      <label class="item-todo" for="${escapeHtml(itemId)}">
        <input id="${escapeHtml(itemId)}" type="checkbox" data-item="${escapeHtml(itemId)}" ${state.objectives[itemId] ? "checked" : ""}>
        <span><strong>${Number(item.quantity) || 1}x</strong> ${escapeHtml(item.name)}</span>
      </label>
    </li>`;
  }).join("")}</ul>`;
  return {
    button: `<button type="button" class="backpack-button" data-backpack="${escapeHtml(partKey)}" aria-expanded="false" title="Afficher les items requis">
      ${icon("backpack")}<span class="sr-only">Afficher les items requis</span>
    </button>`,
    panel: `<div class="success-items-panel part-items-panel" data-items-panel="${escapeHtml(partKey)}" hidden>
      <strong>Items nécessaires</strong>
      ${itemList}
    </div>`,
  };
}

function renderMetric(group) {
  const current = metricValue(group);
  return `<div class="profession-progress">
    <label for="metric-${escapeHtml(group.id)}">Niveau actuel</label>
    <div class="profession-input-wrap">
      <input id="metric-${escapeHtml(group.id)}" type="number" inputmode="numeric" min="${group.metric.min}" max="${group.metric.max}" value="${current}" data-metric="${escapeHtml(group.id)}">
      <span>/ ${group.metric.max}</span>
    </div>
    <p>Objectif personnel : niveau ${group.metric.target}</p>
  </div>`;
}

function scaffoldMessage(group) {
  if (group.kind === "zone")
    return "Contenu à venir : succès monstres, quêtes locales, donjons et objectifs.";
  if (group.kind === "route") return "Contenu à venir : parcours détaillé à compléter.";
  if (group.kind === "breeding")
    return `${group.raceIds.length} race · ${group.scrolls.length} parchemin · objectifs à compléter.`;
  return "Contenu à venir : structure prête pour recevoir ses étapes.";
}

function renderGroup(module, group, objectives) {
  const stats = groupStats(module, group);
  const locked = groupLocked(module, group);
  const groupId = `${module.id}:${group.id}`;
  const isOpen = openGroupIds.has(groupId);
  const completeClass = stats.total && stats.completed === stats.total
    ? " tier-complete"
    : "";
  const sequence = group.kind === "dofus" && group.order
    ? `<span class="sequence-index" aria-label="Ordre ${group.order}">${Math.round(group.order / 10)}</span>`
    : "";
  const lockedText = locked
    ? `<span class="locked-note">${icon("shield")}Prérequis non terminé</span>`
    : "";
  const paginated = module.id !== "lore";
  const pageCount = paginated ? Math.ceil(objectives.length / 10) : 1;
  const page = Math.min(objectivePages.get(groupId) || 0, Math.max(0, pageCount - 1));
  objectivePages.set(groupId, page);
  const pageObjectives = paginated
    ? objectives.slice(page * 10, page * 10 + 10)
    : objectives;
  const successSections = [];
  pageObjectives.forEach((objective) => {
    let part = successSections.find((section) => section.partId === objective.partId);
    if (!part) {
      part = {
        partId: objective.partId,
        partName: objective.partName,
        partItemsRequired: objective.partItemsRequired,
        objectives: [],
        successes: [],
      };
      successSections.push(part);
    }
    part.objectives.push(objective);
    const existing = part.successes.find((section) => section.successId === objective.successId);
    if (existing) existing.objectives.push(objective);
    else part.successes.push({ successId: objective.successId, objectives: [objective] });
  });
  const renderedObjectives = module.id === "lore"
    ? successSections.map((part) => {
        const successes = part.successes.map((section) =>
          renderSuccessSection(module, group, section.successId, section.objectives, locked),
        ).join("");
        return successSections.length > 1
          ? `<details class="part-accordion" data-part="${escapeHtml(`${module.id}:${group.id}:${part.partId || "direct"}`)}">
              <summary>${renderPartHeading(part.partName)}</summary>
              ${successes}
            </details>`
          : successes;
      }).join("")
    : pageObjectives.map((objective) => renderObjective(module, group, objective, locked)).join("");
  const pagination = pageCount > 1
    ? `<label class="quest-pagination" for="page-${escapeHtml(groupId)}">
        <span>Quêtes affichées</span>
        <select id="page-${escapeHtml(groupId)}" data-page-group="${escapeHtml(groupId)}">
          ${Array.from({ length: pageCount }, (_, index) => {
            const start = index * 10 + 1;
            const end = Math.min((index + 1) * 10, objectives.length);
            return `<option value="${index}" ${index === page ? "selected" : ""}>${start}–${end}</option>`;
          }).join("")}
        </select>
      </label>`
    : "";
  const content = group.metric
    ? renderMetric(group)
    : pageObjectives.length
      ? `${pagination}${renderedObjectives}`
      : `${pagination}<p class="scaffold-empty">Toutes les quêtes de ce succès sont terminées.</p>`;
  const itemsPanel = renderPartItemsPanel(module, group);
  return `<details class="tier group-card${completeClass}${locked ? " has-unmet-prerequisite" : ""}" data-group="${escapeHtml(groupId)}" ${isOpen ? "open" : ""}>
    <summary class="tier-header">
      <div class="tier-title">
        <h2>${sequence}${escapeHtml(group.name)}</h2>
        <span class="badge">${escapeHtml(stats.label)}</span>
      </div>
      <div class="group-summary">
        ${group.description ? `<p>${escapeHtml(group.description)}</p>` : ""}
        <div class="objective-badges">${groupBadges(group)}</div>
        ${lockedText}
      </div>
      ${itemsPanel.button}
      <div class="tier-journey">
        <span>${stats.total ? `${escapeHtml(stats.label)} · ${stats.percent} %` : "À venir"}</span>
        <div class="tier-progress" role="progressbar" aria-label="Progression ${escapeHtml(group.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stats.percent}"><i style="width:${stats.percent}%"></i></div>
      </div>
      <span class="tier-chevron" aria-hidden="true">${icon("chevron")}</span>
      <button type="button" class="tier-complete-button${stats.total && stats.completed === stats.total ? " is-complete" : ""}" data-complete-group="${escapeHtml(groupId)}" aria-label="${stats.total && stats.completed === stats.total ? "Palier déjà terminé" : `Valider toutes les étapes de ${group.name}`}" title="${stats.total && stats.completed === stats.total ? "Palier déjà terminé" : "Valider toutes les étapes"}">
        ${icon("check")}
      </button>
    </summary>
    <div class="task-list">${itemsPanel.panel}${content}</div>
  </details>`;
}

function renderCatalog(module) {
  let visibleGroups = 0;
  const sections = module.sections
    .map((section) => {
      const isHidden = hiddenSections.has(section.id);
      const cards = section.groups
        .map((group) => {
          const objectives = filteredObjectives(module, group);
          if (!groupVisible(module, group, objectives)) return "";
          visibleGroups += 1;
          return renderGroup(module, group, objectives);
        })
        .join("");
      if (!cards && !isHidden) return "";
      return `<section class="catalog-section${section.sequential ? " is-sequential" : ""}${isHidden ? " is-hidden" : ""}" aria-labelledby="section-${escapeHtml(section.id)}">
        <div class="catalog-section-heading">
          <div><p class="eyebrow">${escapeHtml(module.shortLabel)}</p><h3 id="section-${escapeHtml(section.id)}">${escapeHtml(section.title)}</h3></div>
          <div class="catalog-section-actions">
            ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ""}
            <button type="button" class="button button-small button-ghost section-visibility-button" data-hide-section="${escapeHtml(section.id)}" aria-pressed="${String(isHidden)}">${isHidden ? "Afficher la catégorie" : "Masquer la catégorie"}</button>
          </div>
        </div>
        ${isHidden ? "" : `<div class="section-grid">${cards}</div>`}
      </section>`;
    })
    .join("");
  elements.tiers.innerHTML = sections;
  return visibleGroups;
}

function hasModuleProgress(module) {
  return moduleGroups(module).some((group) => {
    if (group.metric) return metricValue(group) > group.metric.min;
    return group.objectives.some((objective) => isObjectiveDone(module, objective));
  });
}

function progressMessage(stats) {
  if (!stats.total) return "Structure prête à recevoir ses premiers objectifs.";
  if (stats.percent === 100) return "Module entièrement accompli !";
  if (stats.percent >= 60) return "La majeure partie du parcours est derrière vous.";
  if (stats.percent >= 25) return "Belle progression, continuez ainsi.";
  if (stats.percent > 0) return "Le parcours est lancé.";
  return "Votre progression commence ici.";
}

function renderCategoryFilters(module) {
  const ignoredTags = new Set(["city", "island", "event", "endgame", "activity"]);
  const ignoredLoreTags = new Set(["dofus", "primordial"]);
  const tags = new Set(moduleGroups(module).flatMap((group) => {
    const sourceTags = module.id === "lore"
      ? asArray(group.tags)
      : [
          ...asArray(group.tags),
          ...group.objectives.flatMap((objective) => asArray(objective.tags)),
        ];
    return sourceTags
      .filter((tag) => typeof tag === "string")
      .map((tag) => normalizeSearch(tag).replace(/\s+/g, "-"))
      .filter((tag) =>
        !ignoredTags.has(tag) &&
        !(module.id === "lore" && (
          ignoredLoreTags.has(tag) || /^niveau-\d+$/.test(tag)
        )),
      );
  }));
  const fill = (select, values, allLabel, selected) => {
    select.innerHTML = [`<option value="all">${allLabel}</option>`, ...values
      .sort()
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(humanize(value))}</option>`)]
      .join("");
    select.value = values.includes(selected) ? selected : "all";
  };
  const themeForTag = (tag) => {
    const zones = new Set([
      "amakna", "astrub", "enutrosor", "frigost", "moon", "otomai",
      "sufokia", "wabbit", "xelorium", "srambad", "meriana", "pandala",
    ]);
    const progression = /^(niveau-\d+|debutant|primordial|mise-a-jour-.+)$/.test(tag);
    const playstyle = new Set(["solo", "duo", "compagnons", "prudent", "prospection", "quotidienne"]);
    if (zones.has(tag)) return "Zones et régions";
    if (progression) return "Progression";
    if (playstyle.has(tag)) return "Style de jeu";
    return "Contenus et Dofus";
  };
  const groupedTags = [...tags].reduce((groups, tag) => {
    const theme = themeForTag(tag);
    if (!groups[theme]) groups[theme] = [];
    groups[theme].push(tag);
    return groups;
  }, {});
  const tagChoice = (tag) =>
    `<label class="tag-choice"><input type="checkbox" value="${escapeHtml(tag)}" ${
      activeTags.includes(tag) ? "checked" : ""
    }>${escapeHtml(humanize(tag))}</label>`;
  fill(elements.categoryFilter, module.categories, "Tous les types", activeCategory);
  elements.tagFilters.innerHTML = [
    `<label class="tag-choice"><input type="checkbox" value="" ${
      activeTags.length ? "" : "checked"
    }>Tous les tags</label>`,
    ...Object.entries(groupedTags)
      .sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([theme, themeTags]) =>
        `<details class="tag-theme">
          <summary>${escapeHtml(theme)} <span>${themeTags.length}</span></summary>
          <div class="tag-theme-options">${themeTags.sort((a, b) => a.localeCompare(b, "fr")).map(tagChoice).join("")}</div>
        </details>`,
      ),
  ].join("");
}

function renderZoneFilter(module) {
  const zones = module.sections
    .flatMap((section) => section.groups)
    .filter((group) => group.kind === "zone")
    .sort(byOrder);
  elements.zoneFilterField.hidden = !zones.length;
  elements.zoneFilter.innerHTML = [
    '<option value="all">Toutes</option>',
    ...zones.map(
      (zone) =>
        `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name)}</option>`,
    ),
  ].join("");
  elements.zoneFilter.value = zones.some((zone) => zone.id === activeZone)
    ? activeZone
    : "all";
}

function updateInterface(module, stats, visibleGroups) {
  elements.progressEyebrow.textContent = `Progression · ${module.shortLabel}`;
  elements.progressText.textContent = `${stats.completed} / ${stats.total}`;
  elements.progressUnit.textContent = module.progressUnit;
  elements.progressPercent.textContent = stats.percent;
  elements.progressFill.style.width = `${stats.percent}%`;
  elements.progressBar.setAttribute("aria-valuenow", stats.percent);
  elements.progressMessage.textContent = progressMessage(stats);
  elements.questEyebrow.textContent = module.eyebrow;
  elements.questTitle.textContent = module.title;
  elements.searchLabel.textContent = module.searchPlaceholder;
  elements.searchInput.placeholder = module.searchPlaceholder;
  elements.objectiveSearchInput.value = objectiveSearchTerm;
  elements.moduleNotice.hidden = !usingFallbackData;
  elements.moduleNotice.textContent = usingFallbackData
    ? "Mode local actif : lancez le site via un serveur local (http://localhost) pour charger les JSON complets."
    : "";
  elements.emptyTitle.textContent = "Aucun parcours trouvé";
  elements.emptyText.textContent = visibleGroups
    ? ""
    : "Modifiez la recherche ou les filtres pour afficher d’autres cartes, ou revenez plus tard : contenu à venir.";
  elements.resultCount.textContent = `${visibleGroups} carte${visibleGroups === 1 ? "" : "s"} affichée${visibleGroups === 1 ? "" : "s"}`;
  elements.hideCompletedLabel.textContent = hideCompleted
    ? "Afficher les progressions achevées (100 %)"
    : "Masquer les progressions achevées (100 %)";
  elements.checkAllLabel.textContent = "Tout terminer";
  elements.resetLabel.textContent = "Effacer la progression";
  elements.checkAll.disabled = !stats.total || stats.percent === 100;
  elements.openReset.disabled = !hasModuleProgress(module);
  renderCategoryFilters(module);
  renderZoneFilter(module);
  updateSaveStatus();
}

function updateTabs() {
  document.querySelectorAll(".module-tab").forEach((button) => {
    const selected = button.dataset.module === activeModuleId;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  elements.moduleContent.setAttribute(
    "aria-labelledby",
    `module-tab-${activeModuleId}`,
  );
}

function render({ focusId = "" } = {}) {
  const module = currentModule();
  if (!module) return;
  const visibleGroups = renderCatalog(module);
  const stats = moduleStats(module);
  elements.emptyState.hidden = visibleGroups > 0;
  updateInterface(module, stats, visibleGroups);
  updateTabs();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function resetFilters() {
  activeStatus = "all";
  activeCategory = "all";
  activeTags = [];
  activeLevel = "all";
  activeZone = "all";
  searchTerm = "";
  objectiveSearchTerm = "";
  hideCompleted = false;
  hiddenSections = new Set();
  elements.searchInput.value = "";
  elements.objectiveSearchInput.value = "";
  elements.hideCompleted.setAttribute("aria-pressed", "false");
  elements.hideCompleted.classList.remove("is-active");
  elements.levelFilter.value = "all";
  elements.zoneFilter.value = "all";
  document.querySelectorAll(".filters [data-filter]").forEach((button) => {
    const selected = button.dataset.filter === "all";
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function rememberFilters() {
  filterState[activeModuleId] = {
    status: activeStatus,
    category: activeCategory,
    tags: activeTags,
    level: activeLevel,
    zone: activeZone,
    search: searchTerm,
    objectiveSearch: objectiveSearchTerm,
    hideCompleted,
    hiddenSections: [...hiddenSections],
  };
  state.filters = filterState;
  saveState();
}

function restoreFilters(moduleId) {
  const saved = filterState[moduleId] || {};
  activeStatus = saved.status || "all";
  activeCategory = saved.category || "all";
  activeTags = Array.isArray(saved.tags)
    ? saved.tags
    : saved.tag && saved.tag !== "all"
      ? [saved.tag]
      : [];
  activeLevel = saved.level || "all";
  activeZone = saved.zone || "all";
  searchTerm = saved.search || "";
  objectiveSearchTerm = saved.objectiveSearch || "";
  hideCompleted = Boolean(saved.hideCompleted);
  hiddenSections = new Set(Array.isArray(saved.hiddenSections) ? saved.hiddenSections : []);
  elements.searchInput.value = searchTerm;
  elements.objectiveSearchInput.value = objectiveSearchTerm;
  elements.hideCompleted.setAttribute("aria-pressed", String(hideCompleted));
  elements.hideCompleted.classList.toggle("is-active", hideCompleted);
  elements.levelFilter.value = activeLevel;
  elements.zoneFilter.value = activeZone;
  document.querySelectorAll(".filters [data-filter]").forEach((button) => {
    const selected = button.dataset.filter === activeStatus;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function activateModule(moduleId) {
  if (moduleId === activeModuleId) return;
  rememberFilters();
  activeModuleId = moduleId;
  restoreFilters(moduleId);
  render();
}

elements.searchInput.addEventListener("input", (event) => {
  searchTerm = normalizeSearch(event.target.value.trim());
  rememberFilters();
  render();
});

elements.objectiveSearchInput.addEventListener("input", (event) => {
  objectiveSearchTerm = normalizeSearch(event.target.value.trim());
  rememberFilters();
  render();
});

elements.levelFilter.addEventListener("change", (event) => {
  activeLevel = event.target.value;
  rememberFilters();
  render({ focusId: "levelFilter" });
});

document.querySelectorAll(".filters [data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.filter;
    rememberFilters();
    document.querySelectorAll(".filters [data-filter]").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-active", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    render({ focusId: button.id });
  });
});

elements.categoryFilter.addEventListener("change", (event) => {
  activeCategory = event.target.value;
  rememberFilters();
  render({ focusId: "categoryFilter" });
});

elements.tagFilters.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='checkbox']");
  if (!input) return;
  if (!input.value) {
    activeTags = [];
  } else {
    activeTags = activeTags.includes(input.value)
      ? activeTags.filter((tag) => tag !== input.value)
      : [...activeTags, input.value];
  }
  rememberFilters();
  render();
});

elements.zoneFilter.addEventListener("change", (event) => {
  activeZone = event.target.value;
  rememberFilters();
  render({ focusId: "zoneFilter" });
});

elements.resetFilters.addEventListener("click", () => {
  resetFilters();
  rememberFilters();
  render({ focusId: "resetFilters" });
});

function setAllGroups(open) {
  const visibleDetails = [...elements.tiers.querySelectorAll("details[data-group]")];
  visibleDetails.forEach((details) => {
    details.open = open;
    if (open) openGroupIds.add(details.dataset.group);
    else openGroupIds.delete(details.dataset.group);
  });
  state.openGroups = [...openGroupIds];
  saveState();
}

elements.expandAll.addEventListener("click", () => {
  setAllGroups(true);
  showToast("Toutes les cartes affichées sont ouvertes.");
});

elements.collapseAll.addEventListener("click", () => {
  setAllGroups(false);
  showToast("Toutes les cartes affichées sont fermées.");
});

elements.hideCompleted.addEventListener("click", () => {
  hideCompleted = !hideCompleted;
  elements.hideCompleted.setAttribute("aria-pressed", String(hideCompleted));
  elements.hideCompleted.classList.toggle("is-active", hideCompleted);
  rememberFilters();
  render({ focusId: "hideCompleted" });
});

const moduleTabs = [...document.querySelectorAll(".module-tab")];
moduleTabs.forEach((button, index) => {
  button.addEventListener("click", () => activateModule(button.dataset.module));
  button.addEventListener("keydown", (event) => {
    let targetIndex;
    if (event.key === "ArrowRight") targetIndex = (index + 1) % moduleTabs.length;
    else if (event.key === "ArrowLeft")
      targetIndex = (index - 1 + moduleTabs.length) % moduleTabs.length;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = moduleTabs.length - 1;
    else return;
    event.preventDefault();
    const target = moduleTabs[targetIndex];
    activateModule(target.dataset.module);
    target.focus();
  });
});

elements.tiers.addEventListener("toggle", (event) => {
  const successDetails = event.target.closest("details[data-success]");
  if (successDetails) {
    if (successDetails.open) {
      elements.tiers.querySelectorAll("details[data-success]").forEach((candidate) => {
        if (candidate !== successDetails) candidate.open = false;
      });
    }
    return;
  }
  const details = event.target.closest("details[data-group]");
  if (!details) return;
  if (details.open) openGroupIds.add(details.dataset.group);
  else openGroupIds.delete(details.dataset.group);
  state.openGroups = [...openGroupIds];
  saveState();
}, true);

elements.tiers.addEventListener("click", (event) => {
  const sectionButton = event.target.closest("[data-hide-section]");
  if (sectionButton) {
    event.preventDefault();
    event.stopPropagation();
    const sectionId = sectionButton.dataset.hideSection;
    if (hiddenSections.has(sectionId)) hiddenSections.delete(sectionId);
    else hiddenSections.add(sectionId);
    rememberFilters();
    render({ focusId: sectionButton.id });
    return;
  }
  const completeButton = event.target.closest("[data-complete-group]");
  if (completeButton) {
    event.preventDefault();
    event.stopPropagation();
    const module = currentModule();
    const group = moduleGroups(module).find(
      (candidate) => `${module.id}:${candidate.id}` === completeButton.dataset.completeGroup,
    );
    if (!group) return;
    group.objectives.forEach((objective) => {
      state.objectives[objectiveStateId(module, objective)] = true;
    });
    if (group.metric) state.metrics[metricStateId(group)] = group.metric.target;
    saveState();
    render();
    showToast(`Le palier « ${group.name} » est marqué comme terminé.`);
    return;
  }
  const backpack = event.target.closest("[data-backpack]");
  if (backpack) {
    event.preventDefault();
    event.stopPropagation();
    const panel = elements.tiers.querySelector(
      `[data-items-panel="${CSS.escape(backpack.dataset.backpack)}"]`,
    );
    if (!panel) return;
    const hidden = panel.hidden;
    panel.hidden = !hidden;
    backpack.setAttribute("aria-expanded", String(hidden));
    return;
  }
  const summary = event.target.closest("details[data-success] > summary");
  if (!summary) return;
  const details = summary.parentElement;
  if (!details.open) {
    elements.tiers.querySelectorAll("details[data-success][open]").forEach((candidate) => {
      if (candidate !== details) candidate.open = false;
    });
  }
});

elements.tiers.addEventListener("change", (event) => {
  const module = currentModule();
  const pageSelect = event.target.closest("select[data-page-group]");
  if (pageSelect) {
    objectivePages.set(pageSelect.dataset.pageGroup, Number(pageSelect.value) || 0);
    render({ focusId: pageSelect.id });
    return;
  }
  const checkbox = event.target.closest("input[data-objective]");
  if (checkbox) {
    const openDetails = captureOpenQuestDetails();
    const objectiveId = checkbox.dataset.objective;
    const objective = moduleGroups(module)
      .flatMap((group) => group.objectives)
      .find((candidate) => candidate.id === objectiveId);
    if (!objective) return;
    const id = objectiveStateId(module, objective);
    if (checkbox.checked) state.objectives[id] = true;
    else delete state.objectives[id];
    saveState();
    render({ focusId: checkbox.id });
    restoreOpenQuestDetails(openDetails);
    showToast(checkbox.checked ? "Objectif terminé." : "Objectif remis à faire.");
    return;
  }
  const itemCheckbox = event.target.closest("input[data-item]");
  if (itemCheckbox) {
    const openDetails = captureOpenQuestDetails();
    const id = itemCheckbox.dataset.item;
    if (itemCheckbox.checked) state.objectives[id] = true;
    else delete state.objectives[id];
    saveState();
    render({ focusId: itemCheckbox.id });
    restoreOpenQuestDetails(openDetails);
    showToast(itemCheckbox.checked ? "Item ajouté à la progression." : "Item remis à faire.");
    return;
  }

  const metricInput = event.target.closest("input[data-metric]");
  if (!metricInput) return;
  const group = moduleGroups(module).find(
    (candidate) => candidate.id === metricInput.dataset.metric,
  );
  if (!group?.metric) return;
  const value = Math.min(
    group.metric.max,
    Math.max(group.metric.min, Number(metricInput.value) || group.metric.min),
  );
  const metricId = metricStateId(group);
  if (value === group.metric.initial) delete state.metrics[metricId];
  else state.metrics[metricId] = value;
  saveState();
  render({ focusId: metricInput.id });
  showToast(`${group.name} : niveau ${value} enregistré.`);
});

elements.checkAll.addEventListener("click", () => {
  const module = currentModule();
  moduleGroups(module).forEach((group) => {
    group.objectives.forEach((objective) => {
      state.objectives[objectiveStateId(module, objective)] = true;
    });
    if (group.metric) state.metrics[metricStateId(group)] = group.metric.target;
  });
  saveState();
  render();
  showToast(`Le module « ${module.shortLabel} » est marqué comme terminé.`);
});

elements.openReset.addEventListener("click", () => {
  const module = currentModule();
  elements.dialogTitle.textContent = `Réinitialiser ${module.shortLabel} ?`;
  elements.resetDialogText.textContent =
    `Toute la progression du module « ${module.label} » sera effacée. Cette action ne peut pas être annulée.`;
  elements.resetDialog.showModal();
});

document
  .getElementById("closeReset")
  .addEventListener("click", () => elements.resetDialog.close());
document
  .getElementById("cancelReset")
  .addEventListener("click", () => elements.resetDialog.close());
document.getElementById("uncheckAll").addEventListener("click", () => {
  const module = currentModule();
  const objectiveIds = new Set(
    moduleGroups(module)
      .flatMap((group) => group.objectives)
      .map((objective) => objectiveStateId(module, objective)),
  );
  Object.keys(state.objectives).forEach((id) => {
    if (objectiveIds.has(id)) delete state.objectives[id];
  });
  moduleGroups(module).forEach((group) => {
    if (group.metric) delete state.metrics[metricStateId(group)];
  });
  saveState();
  elements.resetDialog.close();
  render();
  showToast(`La progression « ${module.shortLabel} » a été réinitialisée.`);
});
elements.resetDialog.addEventListener("click", (event) => {
  if (event.target === elements.resetDialog) elements.resetDialog.close();
});

elements.exportSave.addEventListener("click", () => {
  const payload = {
    format: "todofus-save",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: {
      objectives: state.objectives,
      metrics: state.metrics,
      migrations: state.migrations,
      filters: state.filters,
      openGroups: state.openGroups,
      lastSavedAt: state.lastSavedAt,
      theme: state.theme,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `todoofus-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Sauvegarde exportée.");
});

elements.importSave.addEventListener("click", () => elements.importFile.click());
elements.toggleTheme.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
  saveState();
  showToast(state.theme === "dark" ? "Thème cuir sombre activé." : "Thème clair activé.");
});
elements.importFile.addEventListener("change", () => {
  const [file] = elements.importFile.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const imported = payload?.state;
      if (
        payload?.format !== "todofus-save" ||
        payload?.version !== 1 ||
        !imported ||
        typeof imported !== "object" ||
        typeof imported.objectives !== "object" ||
        typeof imported.metrics !== "object"
      )
        throw new Error("Format de sauvegarde non reconnu.");
      state = {
        objectives: imported.objectives,
        metrics: imported.metrics,
        migrations: imported.migrations || {},
        filters: imported.filters || {},
        openGroups: Array.isArray(imported.openGroups) ? imported.openGroups : [],
        lastSavedAt: imported.lastSavedAt || null,
        theme: imported.theme === "dark" ? "dark" : "light",
      };
      Object.keys(filterState).forEach((key) => delete filterState[key]);
      Object.assign(filterState, state.filters);
      openGroupIds.clear();
      state.openGroups.forEach((id) => openGroupIds.add(id));
      applyTheme(state.theme);
      saveState();
      restoreFilters(activeModuleId);
      render();
      showToast("Sauvegarde importée.");
    } catch (error) {
      showToast(`Import impossible : ${error.message}`);
    } finally {
      elements.importFile.value = "";
    }
  });
  reader.readAsText(file);
});

let usingFallbackData = false;

async function boot() {
  elements.tiers.innerHTML = `<div class="loading-state">${icon("spark")}Chargement des données…</div>`;
  try {
    if (!window.ToDofusData)
      throw new Error("Le chargeur de données est indisponible.");
    const data = await window.ToDofusData.load();
    usingFallbackData = data.usedFallback;
    modules = buildModules(data);
    restoreFilters(activeModuleId);
    render();
  } catch (error) {
    elements.tiers.innerHTML = "";
    elements.emptyState.hidden = false;
    elements.emptyTitle.textContent = "Données indisponibles";
    elements.emptyText.textContent = error.message;
  }
}

boot();

/* Couche d'entrée unique des données Todoofus.
   Les composants ne connaissent ni les chemins de fichiers, ni le CSV. */
(function exposeDataLoader() {
  const files = {
    zones: "data/zones.json",
    rushStarter: "data/rush-starter.json",
    routes: "data/parcours.json",
    successes: "data/succes.json",
    quests: "data/quetes.json",
    questsWithoutSuccesses: "data/quetes-hors-succes.json",
    dofus: "data/dofus.json",
    almanax: "data/almanax.json",
    artisanat: "data/artisanat.json",
    breeding: "data/elevage.json",
  };

  // Permet de conserver une interface utilisable lorsqu'elle est ouverte en file://.
  const fallback = {
    zones: {
      version: 1,
      zones: [
        ["incarnam", "Incarnam", 10, 1, 20],
        ["astrub", "Astrub", 20, 1, 50],
        ["amakna", "Amakna", 30, 20, 120],
        ["pandala", "Pandala", 40, 80, 200],
      ].map(([id, name, order, min, max]) => ({
        id,
        name,
        order,
        levelRange: { min, max },
        supportedTypes: ["monster", "quest", "dungeon", "objective"],
        objectives: [],
      })),
    },
    routes: {
      version: 1,
      routes: [
        ["rush-starter", "Rush Starter", "starter"],
        ["duo", "Duo", "duo"],
        ["prudent", "Prudent", "prudent"],
        ["compagnons", "Compagnons", "companion"],
        ["tour-du-monde", "Tour du Monde", "world-tour"],
        ["gladiatrool", "Gladiatrool", "gladiatrool"],
        ["score-tutu", "Score Tutu", "score-tutu"],
      ].map(([id, name, tag], index) => ({
        id,
        name,
        order: (index + 1) * 10,
        tags: [tag],
        objectives: [],
      })),
    },
    dofus: {
      version: 1,
      tracks: [
        ["dofus-argente", "Dofus Argenté", null],
        ["dofus-cawotte", "Dofus Cawotte", "dofus-argente"],
        ["dokoko", "Dokoko", "dofus-cawotte"],
        ["dofus-emeraude", "Dofus Émeraude", "dokoko"],
        ["dofus-pourpre", "Dofus Pourpre", "dofus-emeraude"],
        ["dofus-turquoise", "Dofus Turquoise", "dofus-pourpre"],
      ].map(([id, name, previousId], index) => ({
        id,
        name,
        previousId,
        order: (index + 1) * 10,
        objectives: [],
      })),
      categories: [
        { id: "anomalies-temporelles", name: "Anomalies Temporelles", order: 100, objectives: [] },
        { id: "fratrie-oublies", name: "Fratrie des Oubliés", order: 110, objectives: [] },
      ],
    },
    professions: {
      version: 1,
      professions: ["Alchimiste", "Paysan", "Bûcheron", "Mineur"].map(
        (name, index) => ({
          id: name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
          name,
          order: (index + 1) * 10,
          progress: { kind: "level", min: 0, max: 200 },
        }),
      ),
    },
    breeding: {
      version: 1,
      generations: [
        { id: "generation-1", name: "Génération 1", order: 10, races: [], scrolls: [], objectives: [] },
      ],
    },
  };
  fallback.rushStarter = { version: 1, routes: fallback.routes.routes.slice(0, 1) };
  fallback.successes = { version: 1, successes: [] };
  fallback.quests = { version: 1, quests: [] };
  fallback.questsWithoutSuccesses = { version: 1, categories: [] };
  fallback.artisanat = fallback.professions;
  fallback.almanax = { version: 1, id: "almanax", name: "Almanax", objectives: [] };

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"' && quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) {
        row.push(value.trim());
        value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(value.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        value = "";
      } else value += character;
    }
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows.shift();
    return rows.map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])),
    );
  }

  function objectiveFromCsv(row) {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      type: row.type || "objective",
      minLevel: Number(row.minLevel) || null,
      maxLevel: Number(row.maxLevel) || null,
      tags: (row.tags || "").split("|").map((tag) => tag.trim()).filter(Boolean),
      order: Number(row.order) || 0,
    };
  }

  async function readJson(key, path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${path}`);
      return { value: await response.json(), fallback: false };
    } catch (error) {
      if (error instanceof SyntaxError) throw error;
      return { value: fallback[key], fallback: true, error };
    }
  }

  const objectiveTypes = new Set([
    "dungeon",
    "quest",
    "monster",
    "objective",
    "achievement",
    "resource",
    "gathering",
    "activity",
    "dofus",
    "anomaly",
    "forgotten",
    "breeding",
  ]);
  const linkedModules = new Set([
    "pvm",
    "quest",
    "artisanat",
    "dofus",
    "rush-starter",
    "elevage",
    "parcours",
    "success",
    "achievement",
  ]);

  function normalizeZoneObjective(zone, entry, index) {
    const sourceId =
      typeof entry?.id === "string" && entry.id.trim()
        ? entry.id
        : `${zone.id}-objectif-${index + 1}`;
    // A success can legitimately be shared by two zones (for example Bonta/Brâkmar).
    // Namespace zone objectives so the PvM state and DOM identifiers stay unambiguous.
    const id = `${zone.id}:${sourceId}`;
    const name = typeof entry?.name === "string" && entry.name.trim()
      ? entry.name
      : typeof entry?.title === "string" && entry.title.trim()
        ? entry.title
        : `Objectif ${index + 1}`;
    return {
      id,
      sourceId,
      name,
      type: entry?.type || "quest",
      minLevel: Number(entry?.minLevel ?? entry?.level ?? zone.levelRange?.min ?? 1),
      maxLevel: Number(entry?.maxLevel ?? entry?.level ?? zone.levelRange?.max ?? 200),
      description: typeof entry?.description === "string" ? entry.description : typeof entry?.summary === "string" ? entry.summary : "",
      tags: Array.isArray(entry?.tags) ? entry.tags.filter((tag) => typeof tag === "string") : [],
      order: Number(entry?.order) || index * 10 + 1,
      linkedModule: typeof entry?.module === "string" ? entry.module : "pvm",
      relatedSuccessIds: Array.isArray(entry?.successIds) ? entry.successIds.filter((successId) => typeof successId === "string") : [],
      links: Array.isArray(entry?.links) ? entry.links : [],
      quests: Array.isArray(entry?.quests) ? entry.quests : [],
      itemsRequired: Array.isArray(entry?.itemsRequired) ? entry.itemsRequired : [],
      prerequisites: Array.isArray(entry?.prerequisites) ? entry.prerequisites : [],
    };
  }

  async function loadZoneDetails(zones) {
    const details = await Promise.all(
      zones.map(async (zone) => {
        const path = `data/zones/${zone.id}.json`;
        try {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) return { zoneId: zone.id, objectives: [], successLinks: [] };
          const payload = await response.json();
          const objectiveEntries = [
            ...(Array.isArray(payload?.objectives) ? payload.objectives : []),
            ...(Array.isArray(payload?.quests) ? payload.quests : []),
            ...(Array.isArray(payload?.successes) ? payload.successes : []),
            ...(Array.isArray(payload?.resources) ? payload.resources : []),
            ...(Array.isArray(payload?.activities) ? payload.activities : []),
          ].map((entry, index) => normalizeZoneObjective(zone, entry, index));
          const successLinks = Array.isArray(payload?.successLinks)
            ? payload.successLinks.filter((link) => link && typeof link === "object")
            : [];
          return {
            zoneId: zone.id,
            objectives: objectiveEntries,
            successLinks,
          };
        } catch {
          return { zoneId: zone.id, objectives: [], successLinks: [] };
        }
      }),
    );

    const byZoneId = new Map(details.map((entry) => [entry.zoneId, entry]));
    return zones.map((zone) => {
      const detail = byZoneId.get(zone.id);
      if (!detail) return zone;
      const zoneObjectives = Array.isArray(zone.objectives) ? zone.objectives : [];
      const successLinks = Array.isArray(zone.successLinks) ? zone.successLinks : [];
      return {
        ...zone,
        objectives: [...zoneObjectives, ...detail.objectives],
        successLinks: [...successLinks, ...detail.successLinks],
      };
    });
  }

  function validateData(data) {
    const errors = [];
    const checkIds = (items, label) => {
      const ids = new Set();
      items.forEach((item) => {
        if (!item || typeof item.id !== "string" || !item.id.trim())
          errors.push(`${label}: identifiant manquant`);
        else if (ids.has(item.id)) errors.push(`${label}: ID dupliqué « ${item.id} »`);
        else ids.add(item.id);
      });
      return ids;
    };
    const checkObjectives = (objectives, label, knownIds, globalIds) => {
      const ids = checkIds(objectives, label);
      objectives.forEach((objective) => {
        if (globalIds) {
          if (globalIds.has(objective.id))
            errors.push(`ID d’objectif dupliqué « ${objective.id} »`);
          else if (objective.id) globalIds.add(objective.id);
        }
        if (objective.type && !objectiveTypes.has(objective.type))
          errors.push(`${label}/${objective.id}: type « ${objective.type} » inconnu`);
        const min = objective.minLevel ?? objective.level;
        const max = objective.maxLevel ?? objective.level;
        if (min != null && max != null && Number(min) > Number(max))
          errors.push(`${label}/${objective.id}: niveaux incohérents`);
        if (knownIds && objective.parentId && !knownIds.has(objective.parentId))
          errors.push(`${label}/${objective.id}: prérequis « ${objective.parentId} » absent`);
        (objective.quests || []).forEach((quest) => {
          if (!quest || typeof quest.id !== "string" || !quest.id.trim())
            errors.push(`${label}/${objective.id}: identifiant de quête manquant`);
          (quest.todoList || []).forEach((item) => {
            if (!item || typeof item.label !== "string")
              errors.push(`${label}/${objective.id}/${quest.id}: objectif de quête invalide`);
          });
        });
      });
      return ids;
    };
    const checkGroups = (groups, label, globalObjectiveIds = new Set()) => {
      const groupIds = checkIds(groups, label);
      groups.forEach((group) => {
        const min = group.levelRange?.min;
        const max = group.levelRange?.max;
        if (min != null && max != null && Number(min) > Number(max))
          errors.push(`${label}/${group.id}: niveaux incohérents`);
        checkObjectives(group.objectives || [], `${label}/${group.id}`, groupIds, globalObjectiveIds);
        (group.groups || []).forEach((nested) =>
          checkObjectives(
            nested.objectives || [],
            `${label}/${group.id}/${nested.id}`,
            null,
            globalObjectiveIds,
          ),
        );
      });
      return groupIds;
    };
    const checkSuccessLinks = (zonesList) => {
      zonesList.forEach((zone) => {
        (zone.successLinks || []).forEach((link) => {
          if (!link || typeof link.id !== "string" || !link.id.trim())
            errors.push(`zones/${zone.id}: lien de succès sans identifiant`);
          if (link?.module && !linkedModules.has(link.module))
            errors.push(`zones/${zone.id}/${link.id}: module « ${link.module} » inconnu`);
          if (Array.isArray(link.relatedIds) && link.relatedIds.some((item) => typeof item !== "string"))
            errors.push(`zones/${zone.id}/${link.id}: identifiants liés invalides`);
        });
      });
    };
    const zones = Array.isArray(data.zones?.zones) ? data.zones.zones : [];
    const routes = Array.isArray(data.routes?.routes) ? data.routes.routes : [];
    const dofus = Array.isArray(data.dofus?.dofus) ? data.dofus.dofus : [];
    const tracks = Array.isArray(data.dofus?.tracks) ? data.dofus.tracks : [];
    checkGroups(zones, "zones");
    checkSuccessLinks(zones);
    checkGroups(routes, "routes");
    const dofusIds = checkIds(dofus, "dofus");
    const trackIds = checkIds(tracks, "dofus.tracks");
    tracks.forEach((track) => {
      if (track.type && !["linear", "flexible"].includes(track.type))
        errors.push(`dofus.tracks/${track.id}: type de parcours « ${track.type} » inconnu`);
    });
    const dofusObjectiveIds = new Set();
    dofus.forEach((entry) => {
      const progression = entry.progression || {};
      if (progression.trackId && !trackIds.has(progression.trackId))
        errors.push(`dofus/${entry.id}: parcours « ${progression.trackId} » absent`);
      (progression.requiredIds || []).forEach((requiredId) => {
        if (!dofusIds.has(requiredId))
          errors.push(`dofus/${entry.id}: prérequis « ${requiredId} » absent`);
      });
      checkObjectives(entry.objectives || [], `dofus/${entry.id}`, null, dofusObjectiveIds);
      const successIds = new Set((entry.objectives || []).map((objective) => objective.id));
      (entry.parts || []).forEach((part) => {
        if (!part || typeof part.id !== "string" || !part.id.trim())
          errors.push(`dofus/${entry.id}: partie sans identifiant`);
        (part.successes || []).forEach((successId) => {
          if (!successIds.has(successId))
            errors.push(`dofus/${entry.id}/${part.id}: succès « ${successId} » absent`);
        });
      });
    });
    const professions = Array.isArray(data.professions?.professions)
      ? data.professions.professions
      : [];
    checkIds(professions, "professions");
    const generations = Array.isArray(data.breeding?.generations)
      ? data.breeding.generations
      : [];
    checkGroups(generations, "breeding");
    if (errors.length) throw new Error(`Validation des données impossible : ${errors.join(" ; ")}`);
    return data;
  }

  async function load() {
    const entries = await Promise.all(
      Object.entries(files).map(async ([key, path]) => [key, await readJson(key, path)]),
    );
    const loaded = Object.fromEntries(entries);
    const dofusEntries = loaded.dofus.value.dofus || [];
    const dofusById = new Map(dofusEntries.map((entry) => [entry.id, entry]));
    (loaded.successes.value.successes || []).forEach(({ dofusId, objective }) => {
      const entry = dofusById.get(dofusId);
      if (!entry || !objective) return;
      if (!Array.isArray(entry.objectives)) entry.objectives = [];
      entry.objectives.push(objective);
    });
    const objectivesById = new Map(
      dofusEntries.flatMap((entry) =>
        (entry.objectives || []).map((objective) => [`${entry.id}:${objective.id}`, objective]),
      ),
    );
    (loaded.quests.value.quests || []).forEach(({ dofusId, successId, quests }) => {
      const objective = objectivesById.get(`${dofusId}:${successId}`);
      if (objective && Array.isArray(quests)) objective.quests = quests;
    });
    const data = {
      zones: loaded.zones.value,
      routes: {
        version: Math.max(
          loaded.rushStarter.value.version || 1,
          loaded.routes.value.version || 1,
        ),
        routes: [
          ...(loaded.rushStarter.value.routes || []),
          ...(loaded.routes.value.routes || []),
        ],
      },
      dofus: loaded.dofus.value,
      questsWithoutSuccesses: loaded.questsWithoutSuccesses.value,
      almanax: loaded.almanax.value,
      professions: loaded.artisanat.value,
      breeding: loaded.breeding.value,
      usedFallback: Object.values(loaded).some((entry) => entry.fallback),
    };
    data.zones.zones = await loadZoneDetails(data.zones.zones || []);
    validateData(data);
    return data;
  }

  window.ToDofusData = { files, load, parseCsv, objectiveFromCsv, validateData };
})();

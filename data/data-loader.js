/* Couche d'entrée unique des données Todoofus.
   Les composants ne connaissent ni les chemins de fichiers, ni le CSV. */
(function exposeDataLoader() {
  const files = {
    zones: "data/zones.json",
    routes: "data/dungeon-routes.json",
    dofus: "data/dofus.json",
    professions: "data/professions.json",
    breeding: "data/breeding.json",
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
    "dofus",
    "anomaly",
    "forgotten",
    "breeding",
  ]);

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

    const zones = Array.isArray(data.zones?.zones) ? data.zones.zones : [];
    const routes = Array.isArray(data.routes?.routes) ? data.routes.routes : [];
    const dofus = Array.isArray(data.dofus?.dofus) ? data.dofus.dofus : [];
    const tracks = Array.isArray(data.dofus?.tracks) ? data.dofus.tracks : [];
    checkGroups(zones, "zones");
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
    const data = {
      zones: loaded.zones.value,
      routes: loaded.routes.value,
      dofus: loaded.dofus.value,
      professions: loaded.professions.value,
      breeding: loaded.breeding.value,
      usedFallback: Object.values(loaded).some((entry) => entry.fallback),
    };
    validateData(data);
    return data;
  }

  window.ToDofusData = { files, load, parseCsv, objectiveFromCsv, validateData };
})();

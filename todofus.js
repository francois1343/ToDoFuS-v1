/* ================================================================
   ToDofus — Données, rendu et interactions
   ================================================================ */
const tiers = [
  {
    name: "Palier I",
    reward: "Mardi 21 juillet, 15 h — Titre « Chasseur(euse) de boucliers »",
    image:
      "https://static.ankama.com/upload/backoffice/direct/2026-07-07/e4f597e7ee137023633909e2beac2ea4.png",
    tasks: [
      ["Cour du Bouftou Royal", 30, "Bouclier du Bouftou Royal"],
      ["Cache de Kankreblath", 40, "Bouclier de Kankreblath"],
      ["Château du Wa Wabbit", 60, "Bouclier Kiafin"],
      ["Cimetière des mastodontes", 80, "Bouclier du Mantiscore"],
      ["Bateau du Chouque", 90, "Bouclier Chouquant"],
    ],
  },
  {
    name: "Palier II",
    reward: "Mardi 28 juillet, 15 h — 1 jeton de loterie de la saison Ocre",
    image:
      "https://static.ankama.com/upload/backoffice/direct/2026-07-07/3f21d9b7fc3a6a0bf71dcb7ab92a4e99.png",
    tasks: [
      ["Théâtre du Dramak", 100, "Bouclier de Dramak"],
      ["Caverne du Koulosse", 100, "Kouloclier"],
      ["Bambusaie de Damadrya", 110, "Bouclier végétal de Damadrya"],
      ["Repaire de Crocabulia", 120, "Bouclier de Crocabulia"],
      ["Repaire du Skeunk", 120, "Skeunklier"],
    ],
  },
  {
    name: "Palier III",
    reward: "Mardi 4 août, 15 h — Titre « Passionné(e) de boucliers »",
    image:
      "https://static.ankama.com/upload/backoffice/direct/2026-07-07/e4f597e7ee137023633909e2beac2ea4.png",
    tasks: [
      ["Atelier du Tanukouï San", 130, "Tanuklier"],
      ["Clairière du Chêne Mou", 140, "Bouclier du Chêne Mou"],
      ["Dojo du Vent (Aerdala)", 140, "Bouclier de Daïgoro*"],
      ["Fabrique de Foux d’artifice", 140, "Boucliexplosif de Founoroshi"],
      ["Tombe du Shogun Tofugawa", 160, "Bouclier du Péki Péki*"],
    ],
  },
  {
    name: "Palier IV",
    reward: "Mardi 11 août, 15 h — 1 jeton de loterie de la saison Ocre",
    image:
      "https://static.ankama.com/upload/backoffice/direct/2026-07-07/3f21d9b7fc3a6a0bf71dcb7ab92a4e99.png",
    tasks: [
      ["Mégalithe de Fraktale", 120, "Fraktaklier"],
      ["Repaire du Sphincter Cell", 150, "Bouclier des Rats"],
      ["Plateau du Ush", 160, "Bouclier de Ush"],
      ["Canopée du Kimbo", 160, "Bouclier du Kimbo"],
      ["Grotte du Bworker", 180, "Bworklier"],
    ],
  },
  {
    name: "Palier V",
    reward: "Mardi 18 août, 15 h — 1 jeton de loterie de la saison Ocre",
    image:
      "https://static.ankama.com/upload/backoffice/direct/2026-07-07/3f21d9b7fc3a6a0bf71dcb7ab92a4e99.png",
    tasks: [
      ["Trône de la Cour Sombre", 200, "Bouclier de la Reine des Voleurs"],
      ["Palais de Dantinéa", 200, "Bouclier de Dantinéa"],
      ["Œil du Vortex", 200, "Vortexlier"],
      ["Défi du Chaloeil", 200, "Bouclier du Chaloeil"],
      ["Chambre de Tal Kasha", 200, "Bouclier de Tal Kasha"],
    ],
  },
];

const storageKey = "dofus-boucliers-todo-v1";
const totalTasks = tiers.reduce((total, tier) => total + tier.tasks.length, 0);
const validTaskIds = new Set(
  tiers.flatMap((tier, tierIndex) =>
    tier.tasks.map((_, taskIndex) => `t${tierIndex}-d${taskIndex}`),
  ),
);

let state = {};
let activeFilter = "all";
let searchTerm = "";
let toastTimer;
const openTierIds = new Set(["0"]);

try {
  state = JSON.parse(localStorage.getItem(storageKey) || "{}");
  if (!state || typeof state !== "object" || Array.isArray(state)) state = {};
} catch {
  state = {};
}

const elements = {
  tiers: document.getElementById("tiers"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  searchInput: document.getElementById("searchInput"),
  resetDialog: document.getElementById("resetDialog"),
  toast: document.getElementById("toast"),
};

const icon = (name) =>
  `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
const completedCount = () => [...validTaskIds].filter((id) => state[id]).length;

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(
    () => elements.toast.classList.remove("is-visible"),
    2600,
  );
}

function updateProgress() {
  const completed = completedCount();
  const percent = Math.round((completed / totalTasks) * 100);
  document.getElementById("progressText").textContent =
    `${completed} / ${totalTasks}`;
  document.getElementById("progressPercent").textContent = percent;
  document.getElementById("progressFill").style.width = `${percent}%`;
  document.getElementById("progressBar").setAttribute("aria-valuenow", percent);
  document.getElementById("progressMessage").textContent =
    completed === totalTasks
      ? "Quête légendaire accomplie : tous les boucliers sont à vous !"
      : completed >= 20
        ? "La légende est proche. Encore quelques donjons !"
        : completed >= 10
          ? "Votre collection prend fière allure."
          : completed
            ? "Belle avancée, aventurier. Continuez ainsi."
            : "Votre aventure commence ici.";
}

function taskMatches(name, shield, checked) {
  const matchesSearch = `${name} ${shield}`
    .toLocaleLowerCase("fr")
    .includes(searchTerm);
  const matchesFilter =
    activeFilter === "all" || (activeFilter === "done" ? checked : !checked);
  return matchesSearch && matchesFilter;
}

function renderTask(task, tierIndex, taskIndex) {
  const [name, level, shield] = task;
  const id = `t${tierIndex}-d${taskIndex}`;
  const checked = Boolean(state[id]);
  if (!taskMatches(name, shield, checked)) return "";

  return `<label class="task${checked ? " done" : ""}" for="${id}">
    <input id="${id}" type="checkbox" ${checked ? "checked" : ""}>
    <span class="task-main">
      <span class="task-name">${escapeHtml(name)}</span>
      <span class="task-meta">
        <span>${icon("spark")}<strong>Niveau</strong> ${level}</span>
        <span>${icon("shield")}<strong>Bouclier</strong> ${escapeHtml(shield)}</span>
      </span>
    </span>
  </label>`;
}

function renderTier(tier, tierIndex) {
  const completed = tier.tasks.filter(
    (_, taskIndex) => state[`t${tierIndex}-d${taskIndex}`],
  ).length;
  const tierPercent = Math.round((completed / tier.tasks.length) * 100);
  const tasks = tier.tasks
    .map((task, taskIndex) => renderTask(task, tierIndex, taskIndex))
    .join("");
  if (!tasks) return "";

  const roman = ["I", "II", "III", "IV", "V"][tierIndex];
  const status =
    completed === tier.tasks.length
      ? "Palier accompli"
      : `${tierPercent} % accompli`;
  const autoExpand = Boolean(searchTerm) || activeFilter !== "all";
  const isOpen = autoExpand || openTierIds.has(String(tierIndex));
  return `<details class="tier tier-${tierIndex + 1}${completed === tier.tasks.length ? " tier-complete" : ""}" data-tier="${tierIndex}" data-auto-open="${autoExpand}" ${isOpen ? "open" : ""}>
    <summary class="tier-header">
      <div class="tier-title"><h2><span class="tier-emblem">${roman}</span>${escapeHtml(tier.name)}</h2><span class="badge">${completed} / ${tier.tasks.length}</span></div>
      <div class="tier-reward"><span class="reward-icon">${icon("trophy")}<img src="${tier.image}" alt="" onerror="this.remove()"></span><span>${escapeHtml(tier.reward)}</span></div>
      <div class="tier-journey"><span>${status}</span><div class="tier-progress" role="progressbar" aria-label="Progression ${escapeHtml(tier.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tierPercent}"><i style="width:${tierPercent}%"></i></div></div>
      <span class="tier-chevron" aria-hidden="true">${icon("chevron")}</span>
    </summary>
    <div class="task-list">${tasks}</div>
  </details>`;
}

function render() {
  elements.tiers.innerHTML = tiers.map(renderTier).join("");
  const visibleTasks = elements.tiers.querySelectorAll(".task").length;
  elements.emptyState.hidden = visibleTasks > 0;
  elements.resultCount.textContent = `${visibleTasks} donjon${visibleTasks > 1 ? "s" : ""} affiché${visibleTasks > 1 ? "s" : ""} sur ${totalTasks}`;

  elements.tiers
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        state[checkbox.id] = checkbox.checked;
        save();
        render();
        showToast(
          completedCount() === totalTasks
            ? "Quête légendaire accomplie : collection complète !"
            : checkbox.checked
              ? "Donjon ajouté à vos victoires."
              : "Donjon replacé dans les quêtes à accomplir.",
        );
      });
    });
  elements.tiers.querySelectorAll("details.tier").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.dataset.autoOpen === "true") return;
      if (details.open) {
        openTierIds.clear();
        openTierIds.add(details.dataset.tier);
        elements.tiers
          .querySelectorAll("details.tier[open]")
          .forEach((sibling) => {
            if (sibling !== details) sibling.open = false;
          });
      } else {
        openTierIds.delete(details.dataset.tier);
      }
    });
  });
  updateProgress();
}

elements.searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLocaleLowerCase("fr");
  render();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((filter) => {
      const isActive = filter === button;
      filter.classList.toggle("is-active", isActive);
      filter.setAttribute("aria-pressed", isActive);
    });
    render();
  });
});

document.getElementById("checkAll").addEventListener("click", () => {
  validTaskIds.forEach((id) => {
    state[id] = true;
  });
  save();
  render();
  showToast("Quête accomplie : les 25 donjons sont terminés !");
});

document
  .getElementById("openReset")
  .addEventListener("click", () => elements.resetDialog.showModal());
document
  .getElementById("closeReset")
  .addEventListener("click", () => elements.resetDialog.close());
document
  .getElementById("cancelReset")
  .addEventListener("click", () => elements.resetDialog.close());
document.getElementById("uncheckAll").addEventListener("click", () => {
  state = {};
  save();
  elements.resetDialog.close();
  render();
  showToast("La progression a été réinitialisée.");
});
elements.resetDialog.addEventListener("click", (event) => {
  if (event.target === elements.resetDialog) elements.resetDialog.close();
});

render();

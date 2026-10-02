import { IMMUNE_CONDITIONS, MODULE_ID, OPERATIONAL_PROTOCOL_KEYS } from "./constants.js";
import { PROTOCOLS } from "./protocol-data.js";
import {
  getIntegratedArmor,
  getMortarState,
  getOverloadBand,
  getProtocolSnapshot,
  isMortarActor,
  isMortarTalent
} from "./state.js";
import {
  activateProtocolAbility,
  adjustOverload,
  adjustPartsDie,
  applyRepairResult,
  endPsychosisRound,
  getServiceSummary,
  initializeParts,
  performCoolingTurn,
  performMaintenance,
  performReboot,
  rollRepair,
  setAwakeningDate,
  setStructuralDamage,
  setThermalMode,
  triggerPassive,
  upgradeProtocol
} from "./actions.js";
import { applyThemeClass, getInterfaceTheme } from "./settings.js";

const APP_STATE = new WeakMap();

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function getRoot(htmlOrElement) {
  if (htmlOrElement instanceof HTMLElement) return htmlOrElement;
  if (htmlOrElement?.[0] instanceof HTMLElement) return htmlOrElement[0];
  if (htmlOrElement?.element instanceof HTMLElement) return htmlOrElement.element;
  return null;
}

function getAppRoot(root) {
  return root?.closest?.(".app.window-app, .window-app, .application") ?? root;
}

function actorFromApp(app) {
  const actor = app?.actor ?? app?.document ?? app?.object;
  return actor?.documentName === "Actor" ? actor : null;
}

function rankDots(rank) {
  return Array.from({ length: 5 }, (_, index) => `<span class="fbm-rank-dot ${index < rank ? "is-on" : ""}">${index + 1}</span>`).join("");
}

function renderHeader(actor, editable) {
  const state = getMortarState(actor);
  const band = getOverloadBand(actor, state);
  const passive = state.passive && PROTOCOLS[state.passive]?.passive?.name ? PROTOCOLS[state.passive].passive.name : "—";
  const wpValue = Math.max(0, Number(actor.system?.bio?.willpower?.value) || 0);
  const wpMax = Math.max(wpValue, Number(actor.system?.bio?.willpower?.max) || 10);
  const reputation = Math.max(0, Number(actor.system?.bio?.reputation?.value) || 0);
  const experience = Math.max(0, Number(actor.system?.bio?.experience?.value) || 0);
  const kin = actor.system?.bio?.kin?.value ?? "Мортар";
  return `
    <section class="fbm-header-compact" data-fbm-header-panel="true">
      <div class="fbm-header-compact__avatar ${editable ? "is-editable" : ""}">
        <img src="${escapeHtml(actor.img)}" alt="${escapeHtml(actor.name)}" data-fbm-avatar-image>
        ${editable ? `<button type="button" class="fbm-avatar-edit" data-fbm-change-img title="Изменить портрет"><i class="fas fa-image"></i></button>` : ""}
      </div>
      <div class="fbm-header-compact__grid">
        <label class="fbm-field fbm-field--name"><span>NAME</span><input type="text" data-fbm-actor-path="name" value="${escapeHtml(actor.name)}" ${editable ? "" : "disabled"}></label>
        <label class="fbm-field fbm-field--frame"><span>FRAME</span><input type="text" data-fbm-actor-path="system.bio.kin.value" value="${escapeHtml(kin)}" ${editable ? "" : "disabled"}></label>
        <label class="fbm-field fbm-field--num"><span>REP</span><input type="number" min="0" step="1" data-fbm-actor-path="system.bio.reputation.value" value="${reputation}" ${editable ? "" : "disabled"}></label>
        <label class="fbm-field fbm-field--num"><span>EXP</span><input type="number" min="0" step="1" data-fbm-actor-path="system.bio.experience.value" value="${experience}" ${editable ? "" : "disabled"}></label>
        <label class="fbm-field fbm-field--wp"><span>WP</span><div class="fbm-wp-inline"><input type="number" min="0" step="1" data-fbm-actor-path="system.bio.willpower.value" value="${wpValue}" ${editable ? "" : "disabled"}><small>/ ${wpMax}</small></div></label>
        <label class="fbm-field fbm-field--awakening"><span>AWK</span><input type="text" data-fbm-awakening value="${escapeHtml(state.awakeningDate)}" placeholder="дата / год" ${editable ? "" : "disabled"}></label>
        <div class="fbm-field fbm-field--status"><span>STATUS</span><strong class="fbm-band fbm-band--${band.key}">${band.label}</strong></div>
        <div class="fbm-field fbm-field--passive"><span>PASSIVE</span><strong>${escapeHtml(passive)}</strong></div>
      </div>
    </section>`;
}

function renderOverloadRail(actor) {
  const state = getMortarState(actor);
  const band = getOverloadBand(actor, state);
  const ratio = band.max > 0 ? state.overload / band.max : 0;
  const fill = Math.max(0, Math.min(100, ratio * 100));
  const overflow = state.overload > band.max;
  const title = `OVERLOAD ${state.overload}/${band.max} · ${band.label}`;
  return `
    <div class="fbm-overload-rail fbm-overload-rail--${band.key} ${overflow ? "is-overflow" : ""}"
         data-fbm-overload-rail="true"
         style="--fbm-overload-fill:${fill}%"
         title="${escapeHtml(title)}"
         aria-label="${escapeHtml(title)}">
      <div class="fbm-overload-rail__track">
        <span class="fbm-overload-rail__fill"></span>
        <i class="fbm-overload-rail__mark fbm-overload-rail__mark--50"></i>
        <i class="fbm-overload-rail__mark fbm-overload-rail__mark--75"></i>
        <i class="fbm-overload-rail__mark fbm-overload-rail__mark--100"></i>
      </div>
      <span class="fbm-overload-rail__readout">OL ${state.overload}/${band.max}</span>
    </div>`;
}

function renderStatus(actor, editable) {
  const state = getMortarState(actor);
  const band = getOverloadBand(actor, state);
  const armor = getIntegratedArmor(actor, state);
  const thermalButtons = ["cold", "normal", "heat"].map((mode) => `<button type="button" class="fbm-chip ${state.thermal === mode ? "is-active" : ""}" data-fbm-thermal="${mode}" ${editable ? "" : "disabled"}>${mode.toUpperCase()}</button>`).join("");
  return `
    <section class="fbm-system-status" data-fbm-system-status="true">
      <div class="fbm-section-heading"><span>SYSTEM STATUS</span><small>mechanical body</small></div>
      <div class="fbm-status-grid">
        <div><span>CORE</span><strong class="fbm-band fbm-band--${band.key}">${band.label}</strong></div>
        <div><span>CHASSIS ARMOR</span><strong>${armor}</strong></div>
        <div><span>STRUCT STR</span><strong>${state.structuralDamage.strength}</strong></div>
        <div><span>STRUCT AGI</span><strong>${state.structuralDamage.agility}</strong></div>
      </div>
      <div class="fbm-thermal-row"><span>THERMAL</span>${thermalButtons}</div>
    </section>`;
}

function renderRankRow(key, rank, learnedRank, ability, editable) {
  const unlocked = rank <= learnedRank;
  const supersededRecoveryMode = key === "recovery" && ((rank === 3 && learnedRank >= 4) || (rank === 4 && learnedRank >= 5));
  const canActivate = unlocked && ability.activation && editable && !supersededRecoveryMode;
  return `
    <div class="fbm-ability ${unlocked ? "is-unlocked" : "is-locked"}" data-rank="${rank}">
      <div class="fbm-ability__rank">R${rank}</div>
      <div class="fbm-ability__body">
        <strong>${escapeHtml(ability.name)}</strong>
        <p>${escapeHtml(ability.description)}</p>
      </div>
      ${canActivate ? `<button type="button" class="fbm-icon-button" data-fbm-activate data-protocol="${key}" data-rank="${rank}" title="Активировать"><i class="fas fa-bolt"></i></button>` : ""}
    </div>`;
}

function renderProtocolCard(actor, key, snapshot, editable) {
  const protocol = PROTOCOLS[key];
  const entry = snapshot[key];
  const rank = entry.rank;
  const activePassive = getMortarState(actor).passive === key;
  const passive = protocol.passive;
  const passiveControls = passive && rank > 0
    ? `<div class="fbm-passive ${activePassive ? "is-active" : "is-inactive"}">
        <div><span>PASSIVE</span><strong>${escapeHtml(passive.name)}</strong><p>${escapeHtml(passive.description)}</p></div>
        ${passive.trigger === "wp-die" && activePassive && editable ? `<button type="button" data-fbm-passive-trigger="${key}">TRIGGER</button>` : ""}
      </div>`
    : "";

  const rankRows = protocol.ranks.map((ability) => renderRankRow(key, ability.rank, rank, ability, editable)).join("");
  return `
    <article class="fbm-protocol-card ${rank ? "is-known" : "is-unknown"}" data-protocol-card="${key}">
      <header>
        <div><span class="fbm-kicker">${escapeHtml(protocol.short)}</span><h3>${escapeHtml(protocol.name)}</h3></div>
        <div class="fbm-rank-block"><strong>RANK ${rank}</strong><div>${rankDots(rank)}</div></div>
      </header>
      ${passiveControls}
      <div class="fbm-ability-list">${rankRows}</div>
      <footer>
        ${editable && rank < 5 ? `<button type="button" data-fbm-upgrade="${key}">${rank ? `UPGRADE · ${key === "recovery" ? (rank + 1) * 10 : (rank + 1) * 5} EXP` : "INSTALL"}</button>` : ""}
        ${entry.item ? `<button type="button" data-fbm-open-item="${entry.item.id}"><i class="fas fa-edit"></i> ITEM</button>` : ""}
      </footer>
    </article>`;
}

function renderAuxTalents(actor, snapshot, editable) {
  const protocolIds = new Set(Object.values(snapshot).map((entry) => entry.item?.id).filter(Boolean));
  const talents = actor.items.filter((item) => item.type === "talent" && !protocolIds.has(item.id) && !isMortarTalent(item));
  if (!talents.length) return `<div class="fbm-empty">General Talents: —</div>`;
  return talents.map((item) => `
    <div class="fbm-aux-item" data-item-id="${item.id}">
      <img src="${escapeHtml(item.img)}" alt="">
      <strong>${escapeHtml(item.name)}</strong>
      <span>R${Number(item.system?.rank) || 0}</span>
      ${editable ? `<button type="button" data-fbm-open-item="${item.id}"><i class="fas fa-edit"></i></button>` : ""}
      <button type="button" data-fbm-post-item="${item.id}"><i class="fas fa-comment"></i></button>
    </div>`).join("");
}

function renderProtocols(actor, editable) {
  const state = getMortarState(actor);
  const band = getOverloadBand(actor, state);
  const snapshot = getProtocolSnapshot(actor);
  const operational = OPERATIONAL_PROTOCOL_KEYS.map((key) => renderProtocolCard(actor, key, snapshot, editable)).join("");
  return `
    <div class="fbm-console" data-fbm-console="true">
      <nav class="fbm-console-tabs">
        <button type="button" class="is-active" data-fbm-subtab="protocols">PROTOCOLS</button>
        <button type="button" data-fbm-subtab="service">SERVICE</button>
      </nav>
      <section class="fbm-pane is-active" data-fbm-pane="protocols">
        <div class="fbm-console-summary">
          <div><span>OVERLOAD</span><strong>${state.overload}/${band.max}</strong><em class="fbm-band fbm-band--${band.key}">${band.label}</em></div>
          <div><span>THERMAL</span><strong>${state.thermal.toUpperCase()}</strong></div>
          <div><span>ARMOR</span><strong>${getIntegratedArmor(actor, state)}</strong></div>
          ${editable ? `<div class="fbm-overload-controls"><button type="button" data-fbm-overload="-1">− OL</button><button type="button" data-fbm-overload="1">+ OL</button></div>` : ""}
        </div>
        <div class="fbm-recovery-wrap">${renderProtocolCard(actor, "recovery", snapshot, editable)}</div>
        <div class="fbm-protocol-grid">${operational}</div>
        <section class="fbm-aux">
          <div class="fbm-aux-title">AUXILIARY ROUTINES · GENERAL TALENTS</div>
          <div class="fbm-aux-list">${renderAuxTalents(actor, snapshot, editable)}</div>
        </section>
      </section>
      <section class="fbm-pane" data-fbm-pane="service">${renderService(actor, editable)}</section>
    </div>`;
}

function partsDieLabel(die) {
  return die ? `D${die}` : "—";
}

function renderService(actor, editable) {
  const summary = getServiceSummary(actor);
  const state = summary.state;
  const psychosis = state.psychosis.active
    ? `<div class="fbm-alert"><strong>PSYCHOSIS</strong><span>${state.psychosis.remainingRounds} round(s)</span>${editable ? `<button type="button" data-fbm-psychosis-round>END ROUND</button>` : ""}</div>`
    : "";
  return `
    <div class="fbm-service">
      ${psychosis}
      <div class="fbm-service-grid">
        <section class="fbm-service-card">
          <div class="fbm-section-heading"><span>CORE MAINTENANCE</span><small>Quarter Day operations</small></div>
          <div class="fbm-readout"><span>OVERLOAD</span><strong>${state.overload}/${summary.band.max}</strong><em>${summary.band.label}</em></div>
          <div class="fbm-action-row">
            ${editable ? `<button type="button" data-fbm-reboot><i class="fas fa-power-off"></i> REBOOT</button><button type="button" data-fbm-maintenance><i class="fas fa-screwdriver-wrench"></i> MAINTENANCE</button><button type="button" data-fbm-cooling><i class="fas fa-temperature-half"></i> 15 MIN COOLING</button>` : ""}
          </div>
          <p class="fbm-note">REBOOT: +1 WITS, +1 EMPATHY, OVERLOAD → 0, смена пассивного протокола. MAINTENANCE: OVERLOAD −1D6 и окно для ремонтных операций.</p>
        </section>

        <section class="fbm-service-card">
          <div class="fbm-section-heading"><span>STRUCTURAL DAMAGE</span><small>temporary maximum loss</small></div>
          <div class="fbm-struct-grid">
            <label>STR <input type="number" min="0" value="${state.structuralDamage.strength}" data-fbm-structural="strength" ${editable ? "" : "disabled"}></label>
            <label>AGI <input type="number" min="0" value="${state.structuralDamage.agility}" data-fbm-structural="agility" ${editable ? "" : "disabled"}></label>
          </div>
          <p class="fbm-note">Обычный ремонт восстанавливает STR/AGI. Невосстановленный остаток становится Structural Damage. Точный ремонт снимает Structural Damage.</p>
        </section>

        <section class="fbm-service-card fbm-parts-card">
          <div class="fbm-section-heading"><span>SPARE PARTS</span><small>Consumable Resource</small></div>
          <div class="fbm-parts-row">
            <span>COMMON</span><strong>${partsDieLabel(summary.common.die)}</strong>
            ${editable && summary.common.item ? `<button type="button" data-fbm-parts="common" data-direction="-1">−</button><button type="button" data-fbm-parts="common" data-direction="1">+</button>` : ""}
          </div>
          <div class="fbm-parts-row">
            <span>PRECISION</span><strong>${partsDieLabel(summary.precision.die)}</strong>
            ${editable && summary.precision.item ? `<button type="button" data-fbm-parts="precision" data-direction="-1">−</button><button type="button" data-fbm-parts="precision" data-direction="1">+</button>` : ""}
          </div>
          ${editable && (!summary.common.item || !summary.precision.item) ? `<button type="button" data-fbm-init-parts>ADD STARTING PARTS · D10 / D8</button>` : ""}
        </section>

        <section class="fbm-service-card fbm-repair-card">
          <div class="fbm-section-heading"><span>REPAIR CONTROL</span><small>CRAFTING + Resource Die</small></div>
          <div class="fbm-repair-controls">
            <label>PARTS<select data-fbm-repair-type><option value="common">COMMON</option><option value="precision">PRECISION</option></select></label>
            <label>ATTRIBUTE<select data-fbm-repair-attribute><option value="strength">STR</option><option value="agility">AGI</option></select></label>
          </div>
          ${editable ? `<div class="fbm-action-row"><button type="button" data-fbm-roll-repair>ROLL REPAIR</button><button type="button" data-fbm-apply-repair>APPLY SUCCESSES</button></div>` : ""}
          <p class="fbm-note">ROLL REPAIR открывает системный CRAFTING roll и добавляет Resource Die как Artifact Die. После броска модуль предлагает вручную отметить истощение Resource Die на 1–2.</p>
        </section>
      </div>
    </div>`;
}

function setupSubtabs(consoleRoot) {
  for (const button of consoleRoot.querySelectorAll("[data-fbm-subtab]")) {
    button.addEventListener("click", () => {
      const target = button.dataset.fbmSubtab;
      for (const peer of consoleRoot.querySelectorAll("[data-fbm-subtab]")) peer.classList.toggle("is-active", peer === button);
      for (const pane of consoleRoot.querySelectorAll("[data-fbm-pane]")) pane.classList.toggle("is-active", pane.dataset.fbmPane === target);
    });
  }
}

function bindConsole(app, actor, consoleRoot, editable) {
  setupSubtabs(consoleRoot);
  if (!editable) {
    for (const button of consoleRoot.querySelectorAll("[data-fbm-open-item], [data-fbm-post-item]")) {
      button.addEventListener("click", () => {
        const id = button.dataset.fbmOpenItem ?? button.dataset.fbmPostItem;
        const item = actor.items.get(id);
        if (button.hasAttribute("data-fbm-open-item")) item?.sheet?.render(true);
        else item?.sendToChat?.();
      });
    }
    return;
  }

  for (const button of consoleRoot.querySelectorAll("[data-fbm-upgrade]")) {
    button.addEventListener("click", () => upgradeProtocol(actor, button.dataset.fbmUpgrade));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-activate]")) {
    button.addEventListener("click", () => activateProtocolAbility(actor, button.dataset.protocol, Number(button.dataset.rank)));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-passive-trigger]")) {
    button.addEventListener("click", () => triggerPassive(actor, button.dataset.fbmPassiveTrigger));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-overload]")) {
    button.addEventListener("click", () => adjustOverload(actor, Number(button.dataset.fbmOverload), { reason: "Manual adjustment" }));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-open-item]")) {
    button.addEventListener("click", () => actor.items.get(button.dataset.fbmOpenItem)?.sheet?.render(true));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-post-item]")) {
    button.addEventListener("click", () => actor.items.get(button.dataset.fbmPostItem)?.sendToChat?.());
  }
  consoleRoot.querySelector("[data-fbm-reboot]")?.addEventListener("click", () => performReboot(actor));
  consoleRoot.querySelector("[data-fbm-maintenance]")?.addEventListener("click", () => performMaintenance(actor));
  consoleRoot.querySelector("[data-fbm-cooling]")?.addEventListener("click", () => performCoolingTurn(actor));
  consoleRoot.querySelector("[data-fbm-psychosis-round]")?.addEventListener("click", () => endPsychosisRound(actor));
  consoleRoot.querySelector("[data-fbm-init-parts]")?.addEventListener("click", () => initializeParts(actor));

  for (const input of consoleRoot.querySelectorAll("[data-fbm-structural]")) {
    input.addEventListener("change", () => setStructuralDamage(actor, input.dataset.fbmStructural, input.value));
  }
  for (const button of consoleRoot.querySelectorAll("[data-fbm-parts]")) {
    button.addEventListener("click", () => adjustPartsDie(actor, button.dataset.fbmParts, Number(button.dataset.direction)));
  }
  consoleRoot.querySelector("[data-fbm-roll-repair]")?.addEventListener("click", () => {
    const type = consoleRoot.querySelector("[data-fbm-repair-type]")?.value ?? "common";
    const attribute = consoleRoot.querySelector("[data-fbm-repair-attribute]")?.value ?? "strength";
    return rollRepair(actor, { type, attribute });
  });
  consoleRoot.querySelector("[data-fbm-apply-repair]")?.addEventListener("click", () => {
    const type = consoleRoot.querySelector("[data-fbm-repair-type]")?.value ?? "common";
    const attribute = consoleRoot.querySelector("[data-fbm-repair-attribute]")?.value ?? "strength";
    return applyRepairResult(actor, { type, attribute });
  });
}

function mountTalentConsole(app, actor, root) {
  const talentTab = root.querySelector(".talent-tab")
    ?? root.querySelector('.sheet-body > .tab[data-tab="talent"]')
    ?? root.querySelector('[data-tab="talent"]');
  if (!(talentTab instanceof HTMLElement)) return;

  const host = talentTab.matches('.tab[data-tab="talent"]') ? talentTab : talentTab.closest('.tab[data-tab="talent"]') ?? talentTab;
  const existing = host.querySelector(":scope > .fbm-console, .fbm-console");
  if (existing) return;

  host.innerHTML = renderProtocols(actor, actor.isOwner);
  const consoleRoot = host.querySelector(".fbm-console");
  if (consoleRoot) bindConsole(app, actor, consoleRoot, actor.isOwner);

  const nav = root.querySelector(".sheet-tabs");
  const navButton = nav?.querySelector?.('[data-tab="talent"]');
  if (navButton) navButton.textContent = "PROTOCOLS";
}

function bindHeader(actor, headerRoot, editable) {
  if (!(headerRoot instanceof HTMLElement)) return;
  if (!editable) return;

  for (const input of headerRoot.querySelectorAll('[data-fbm-actor-path]')) {
    input.addEventListener('change', async () => {
      const path = input.dataset.fbmActorPath;
      if (!path) return;
      const value = input.type === 'number' ? Math.max(0, Math.trunc(Number(input.value) || 0)) : String(input.value ?? '');
      await actor.update({ [path]: value }, { render: false });
    });
  }

  const awakening = headerRoot.querySelector('[data-fbm-awakening]');
  awakening?.addEventListener('change', () => setAwakeningDate(actor, awakening.value));

  const changeImg = async () => {
    const FilePickerApp = globalThis.FilePicker;
    if (!FilePickerApp) return ui.notifications?.warn?.('FilePicker unavailable.');
    const picker = new FilePickerApp({
      type: 'image',
      current: actor.img,
      callback: async (path) => actor.update({ img: path })
    });
    return picker.browse();
  };

  headerRoot.querySelector('[data-fbm-change-img]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void changeImg();
  });

  headerRoot.querySelector('[data-fbm-avatar-image]')?.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void changeImg();
  });
}

function mountWindowTheme(actor, root) {
  const appRoot = getAppRoot(root);
  const theme = getInterfaceTheme();
  root.classList.add("fbm-mortar-sheet");
  applyThemeClass(root, theme);

  if (appRoot instanceof HTMLElement) {
    appRoot.classList.add("fbm-mortar-window");
    applyThemeClass(appRoot, theme);
    appRoot.querySelector("[data-fbm-overload-rail]")?.remove();
    appRoot.insertAdjacentHTML("beforeend", renderOverloadRail(actor));
  }
}

function mountHeader(actor, root, editable) {
  const character = root.querySelector(".character") ?? root;
  const bio = character.querySelector(":scope > .bio.border, .bio.border") ?? character.querySelector(".bio");
  if (!(bio instanceof HTMLElement) || bio.querySelector("[data-fbm-header-panel]")) return;
  bio.innerHTML = renderHeader(actor, editable);
  bio.classList.add("fbm-mortar-bio");
  bindHeader(actor, bio.querySelector("[data-fbm-header-panel]"), editable);
}

function mountMainStatus(actor, root, editable) {
  const mainTab = root.querySelector(".main-tab") ?? root.querySelector('.tab[data-tab="main"]');
  if (!mainTab) return;

  for (const condition of IMMUNE_CONDITIONS) {
    for (const control of mainTab.querySelectorAll(`[data-condition="${condition}"]`)) {
      const wrapper = control.closest(".condition") ?? control;
      wrapper.classList.add("fbm-biological-condition");
    }
  }

  const conditions = mainTab.querySelector(".conditions") ?? mainTab;
  if (!conditions.querySelector(".fbm-system-status")) {
    conditions.insertAdjacentHTML("afterbegin", renderStatus(actor, editable));
  }

  if (editable) {
    for (const button of conditions.querySelectorAll("[data-fbm-thermal]")) {
      button.addEventListener("click", () => setThermalMode(actor, button.dataset.fbmThermal));
    }
  }
}

function hideBiologicalConsumables(_root) {
  // Food and water stay visible in inventory. Mortars may still carry them.
}

function replaceRestButton(actor, root, editable) {
  if (!editable) return;
  const appRoot = getAppRoot(root);
  const native = appRoot?.querySelector?.(".fblqa-rest-button, .rest-up");
  if (!(native instanceof HTMLElement)) return;
  if (native.dataset.fbmMortarRest === "true") return;

  const button = native.cloneNode(true);
  button.dataset.fbmMortarRest = "true";
  button.classList.remove("rest-up", "fblqa-rest-button");
  button.classList.add("fbm-reboot-button");
  button.removeAttribute("data-action");
  button.removeAttribute("href");
  button.title = "MORTAR · REBOOT / MAINTENANCE";
  const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
  if (textNodes.length) textNodes[textNodes.length - 1].textContent = " Reboot";
  else button.append(" Reboot");
  native.replaceWith(button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    performReboot(actor);
  }, { capture: true });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    performMaintenance(actor);
  }, { capture: true });
}

export function mountMortarSheet(app, htmlOrElement) {
  const actor = actorFromApp(app);
  const root = getRoot(htmlOrElement ?? app?.element);
  if (!root) return;

  if (!isMortarActor(actor)) {
    const appRoot = getAppRoot(root);
    root.classList.remove("fbm-mortar-sheet");
    if (appRoot instanceof HTMLElement) {
      appRoot.classList.remove("fbm-mortar-window");
      appRoot.querySelector("[data-fbm-overload-rail]")?.remove();
    }
    APP_STATE.delete(app);
    return;
  }

  mountWindowTheme(actor, root);
  const current = APP_STATE.get(app);
  if (current?.root === root && root.dataset.fbmMounted === "true") return;
  APP_STATE.set(app, { root, appRoot: getAppRoot(root) });
  root.dataset.fbmMounted = "true";

  const editable = Boolean(actor.isOwner);
  mountHeader(actor, root, editable);
  mountMainStatus(actor, root, editable);
  mountTalentConsole(app, actor, root);
  hideBiologicalConsumables(root);
  replaceRestButton(actor, root, editable);
}

export function scheduleMortarMount(app, htmlOrElement) {
  queueMicrotask(() => {
    try {
      mountMortarSheet(app, htmlOrElement ?? app?.element);
    } catch (error) {
      console.error(`${MODULE_ID} | sheet mount failed`, error);
    }
  });
}

export function releaseMortarSheet(app) {
  const current = APP_STATE.get(app);
  const root = current?.root;
  const appRoot = current?.appRoot ?? getAppRoot(root);
  root?.classList?.remove("fbm-mortar-sheet");
  if (appRoot instanceof HTMLElement) {
    appRoot.classList.remove("fbm-mortar-window");
    appRoot.querySelector("[data-fbm-overload-rail]")?.remove();
  }
  APP_STATE.delete(app);
}

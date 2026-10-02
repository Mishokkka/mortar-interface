import { MODULE_ID, RESOURCE_DIE_STEPS } from "./constants.js";
import { applyThemeClass, getInterfaceTheme } from "./settings.js";
import { PROTOCOLS } from "./protocol-data.js";
import {
  canUsePassive,
  downgradeResourceDie,
  getIntegratedArmor,
  getMaxOverload,
  getMortarState,
  getOverloadBand,
  getParts,
  getPartsDie,
  getProtocolItem,
  getProtocolRank,
  initializeStartingParts,
  knownOperationalProtocols,
  scheduleActorSheetRender,
  setMortarState,
  setPartsDie
} from "./state.js";

function localize(key, fallback) {
  const value = game.i18n.localize(`${MODULE_ID}.${key}`);
  return value === `${MODULE_ID}.${key}` ? fallback : value;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function readDialogValue(root, selector) {
  const element = root?.querySelector?.(selector) ?? root?.find?.(selector)?.[0] ?? null;
  if (element) return element.value;
  return root?.find?.(selector)?.val?.();
}


function decorateDialogApp(dialog) {
  window.setTimeout(() => {
    const appId = dialog?.appId;
    const element = (appId != null
      ? document.querySelector(`[data-appid="${appId}"]`)
      : null)
      ?? dialog?.element
      ?? document.querySelector('.application.dialog:last-of-type, .dialog.app:last-of-type');
    const appRoot = element?.closest?.('.app.window-app, .window-app, .application') ?? element;
    if (!(appRoot instanceof HTMLElement)) return;
    appRoot.classList.add('fbm-mortar-dialog-window');
    applyThemeClass(appRoot, getInterfaceTheme());
  }, 0);
}

async function legacyPrompt({ title, content, buttons, defaultButton = null, width = 440 }) {
  const defaultAction = defaultButton ?? Object.keys(buttons)[0];
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;

  if (DialogV2) {
    return new Promise((resolve) => {
      let resolved = false;
      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };
      const configuredButtons = Object.entries(buttons).map(([action, button]) => ({
        action,
        label: button.label,
        icon: String(button.icon ?? "").replace(/^<i class=["']|["']><\/i>$/g, "") || undefined,
        default: action === defaultAction,
        callback: (_event, _button, dialog) => finish(button.callback ? button.callback(dialog.element) : action)
      }));
      const dialog = new DialogV2({
        window: { title, resizable: false },
        position: { width },
        content,
        buttons: configuredButtons
      });
      dialog.addEventListener("close", () => finish(null));
      dialog.render(true);
      decorateDialogApp(dialog);
    });
  }

  if (!globalThis.Dialog) {
    ui.notifications?.error?.("Dialog API unavailable.");
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    const dialog = new globalThis.Dialog({
      title,
      content,
      buttons: Object.fromEntries(Object.entries(buttons).map(([key, button]) => [key, {
        icon: button.icon ?? "",
        label: button.label,
        callback: (html) => finish(button.callback ? button.callback(html) : key)
      }])),
      default: defaultAction,
      close: () => finish(null)
    }, { width, classes: ["fbm-mortar-dialog-window"] });
    dialog.render(true);
    decorateDialogApp(dialog);
  });
}

export async function adjustOverload(actor, delta, { reason = "", triggerPsychosis = true } = {}) {
  const state = getMortarState(actor);
  const max = getMaxOverload(actor);
  const old = state.overload;
  // OVERLOAD intentionally has no upper cap. Going beyond MAX makes a deep
  // overload meaningful because a single post-psychosis D6 may not be enough
  // to bring the unit back below the psychosis threshold.
  const next = Math.max(0, Math.trunc(old + Number(delta || 0)));
  const patch = {
    overload: next,
    lastOverloadAt: delta > 0 ? Date.now() : state.lastOverloadAt
  };

  const shouldStartPsychosis = next >= max && !state.psychosis.active && triggerPsychosis;
  if (shouldStartPsychosis) {
    const roundsRoll = await new Roll("1d3").evaluate();
    patch.psychosis = { active: true, remainingRounds: roundsRoll.total };
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fbm-chat"><h3>PSYCHOSIS</h3><p><strong>${escapeHtml(actor.name)}</strong>: ${escapeHtml(String(roundsRoll.total))} раунд(а). OVERLOAD ${next}/${max}.</p>${reason ? `<p>${escapeHtml(reason)}</p>` : ""}</div>`
    });
  }

  return setMortarState(actor, patch);
}

export async function spendWillpower(actor, amount) {
  amount = Math.max(0, Math.trunc(Number(amount) || 0));
  const current = Math.max(0, Number(actor.system?.bio?.willpower?.value) || 0);
  if (current < amount) {
    ui.notifications.warn(localize("NotEnoughWP", "Недостаточно Willpower."));
    return false;
  }
  await actor.update({ "system.bio.willpower.value": current - amount }, { render: false });
  return true;
}

export async function gainWillpower(actor, amount, reason = "") {
  amount = Math.max(0, Math.trunc(Number(amount) || 0));
  const current = Math.max(0, Number(actor.system?.bio?.willpower?.value) || 0);
  const max = Math.max(current, Number(actor.system?.bio?.willpower?.max) || 10);
  const next = Math.min(max, current + amount);
  await actor.update({ "system.bio.willpower.value": next });
  if (reason) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fbm-chat"><p><strong>${escapeHtml(reason)}</strong>: +${next - current} WP.</p></div>`
    });
  }
  return next - current;
}

function calculateActivationCost(actor, key, activation, selection = null, variable = null) {
  if (!activation) return null;
  let spec = activation;
  if (Array.isArray(activation.choices)) {
    spec = activation.choices.find((choice) => choice.id === selection) ?? activation.choices[0];
  }

  if (spec.mode === "variable" || spec.mode === "variable-rank") {
    const rank = getProtocolRank(actor, key);
    const max = spec.mode === "variable-rank" ? rank : Math.min(Number(spec.max) || 10, Math.max(1, Number(actor.system?.bio?.willpower?.value) || 0));
    const value = Math.max(Number(spec.min) || 1, Math.min(max, Math.trunc(Number(variable) || 1)));
    return {
      label: spec.label ?? PROTOCOLS[key]?.name ?? key,
      wp: value * Number(spec.wpMultiplier ?? 1),
      overload: value * Number(spec.overloadMultiplier ?? 1)
    };
  }

  return {
    label: spec.label ?? PROTOCOLS[key]?.name ?? key,
    wp: Math.max(0, Number(spec.wp) || 0),
    overload: Math.max(0, Number(spec.overload ?? spec.wp) || 0)
  };
}

export function getProtocolUpgradeCost(key, targetRank) {
  const rank = Math.max(1, Math.min(5, Math.trunc(Number(targetRank) || 1)));
  return key === "recovery" ? rank * 10 : rank * 5;
}

async function chooseRecoveryAttribute(actor) {
  const attributes = ["strength", "agility", "wits", "empathy"]
    .map((key) => ({ key, data: actor.system?.attribute?.[key] }))
    .filter((entry) => entry.data && Number(entry.data.max) < 6);
  if (!attributes.length) {
    ui.notifications.warn("Все Attributes уже достигли 6. Повышение Recovery Protocol требует увеличить один Attribute.");
    return null;
  }
  const options = attributes.map(({ key, data }) => `<option value="${key}">${key.toUpperCase()} · ${Number(data.max) || 0} → ${(Number(data.max) || 0) + 1}</option>`).join("");
  return legacyPrompt({
    title: "RECOVERY PROTOCOL · ATTRIBUTE",
    content: `<div class="fbm-dialog"><p>Получение этого Rank увеличивает один Attribute на 1, максимум до 6.</p><label>ATTRIBUTE<select name="attribute">${options}</select></label></div>`,
    buttons: {
      ok: { label: localize("Apply", "Применить"), callback: (html) => readDialogValue(html, "select[name='attribute']") },
      cancel: { label: localize("Cancel", "Отмена"), callback: () => null }
    }
  });
}

async function confirmXpSpend(actor, title, cost, detail = "") {
  const xp = Math.max(0, Number(actor.system?.bio?.experience?.value) || 0);
  if (xp < cost) {
    ui.notifications.warn(`Недостаточно EXP: требуется ${cost}, доступно ${xp}.`);
    return false;
  }
  const result = await legacyPrompt({
    title,
    content: `<div class="fbm-dialog"><p>${escapeHtml(detail)}</p><p><strong>EXP: ${xp} → ${xp - cost}</strong></p></div>`,
    buttons: {
      ok: { label: `SPEND ${cost} EXP`, callback: () => true },
      cancel: { label: localize("Cancel", "Отмена"), callback: () => false }
    },
    defaultButton: "cancel"
  });
  return result === true;
}

export async function upgradeProtocol(actor, key) {
  const item = getProtocolItem(actor, key);
  if (!item) return installProtocol(actor, key);
  const current = getProtocolRank(actor, key);
  if (current >= 5) return;
  const target = current + 1;
  const cost = getProtocolUpgradeCost(key, target);
  if (!(await confirmXpSpend(actor, `${PROTOCOLS[key].name} · RANK ${target}`, cost, `Повысить Rank ${current} → ${target}.`))) return;

  let attribute = null;
  if (key === "recovery" && target >= 3) {
    attribute = await chooseRecoveryAttribute(actor);
    if (!attribute) return;
  }

  const xp = Math.max(0, Number(actor.system?.bio?.experience?.value) || 0);
  const actorUpdate = { "system.bio.experience.value": xp - cost };
  if (attribute) {
    const data = actor.system.attribute[attribute];
    const oldMax = Number(data.max) || 0;
    actorUpdate[`system.attribute.${attribute}.max`] = Math.min(6, oldMax + 1);
    actorUpdate[`system.attribute.${attribute}.value`] = Math.min(6, (Number(data.value) || 0) + 1);
  }
  await actor.update(actorUpdate, { render: false });
  await item.update({ "system.rank": target });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fbm-chat"><h3>${escapeHtml(PROTOCOLS[key].name)} · RANK ${target}</h3><p>-${cost} EXP.${attribute ? ` ${attribute.toUpperCase()} +1.` : ""}</p></div>`
  });
}

export async function installProtocol(actor, key) {
  const protocol = PROTOCOLS[key];
  if (!protocol || getProtocolItem(actor, key)) return;

  if (key === "recovery") {
    const created = await actor.createEmbeddedDocuments("Item", [{
      name: protocol.name,
      type: "talent",
      system: { type: "general", rank: 1, description: "" },
      flags: { [MODULE_ID]: { protocolKey: key } }
    }]);
    created?.[0]?.sheet?.render?.(true);
    return;
  }

  const recoveryRank = getProtocolRank(actor, "recovery");
  if (recoveryRank < 2) {
    ui.notifications.warn("Первый Operational Protocol открывается только с Recovery Protocol Rank 2.");
    return;
  }

  const known = knownOperationalProtocols(actor);
  const state = getMortarState(actor);
  const order = [...state.operationalOrder];
  const missingKnown = known
    .filter((existingKey) => !order.includes(existingKey))
    .map((existingKey) => ({ key: existingKey, item: getProtocolItem(actor, existingKey) }))
    .sort((a, b) => (Number(a.item?.sort) || 0) - (Number(b.item?.sort) || 0));
  for (const entry of missingKnown) order.push(entry.key);

  let cost = 0;
  if (known.length > 0) {
    if (recoveryRank < 3) {
      ui.notifications.warn("Дополнительные Operational Protocols открываются с Recovery Protocol Rank 3.");
      return;
    }
    const last = order[order.length - 1] ?? known[known.length - 1];
    if (last && getProtocolRank(actor, last) < 3) {
      ui.notifications.warn(`Сначала развей последний открытый ${PROTOCOLS[last].name} до Rank 3.`);
      return;
    }
    cost = 5;
    if (!(await confirmXpSpend(actor, `${protocol.name} · RANK 1`, cost, "Открыть новый Operational Protocol."))) return;
  }

  if (cost) {
    const xp = Math.max(0, Number(actor.system?.bio?.experience?.value) || 0);
    await actor.update({ "system.bio.experience.value": xp - cost }, { render: false });
  }
  await actor.createEmbeddedDocuments("Item", [{
    name: protocol.name,
    type: "talent",
    system: { type: "general", rank: 1, description: "" },
    flags: { [MODULE_ID]: { protocolKey: key } }
  }]);

  order.push(key);
  const patch = { operationalOrder: [...new Set(order)] };
  if (!state.passive) patch.passive = key;
  await setMortarState(actor, patch);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fbm-chat"><h3>${escapeHtml(protocol.name)} · RANK 1</h3><p>${cost ? `-${cost} EXP.` : "Первый Operational Protocol получен через Recovery Protocol Rank 2."}</p></div>`
  });
}

export async function activateProtocolAbility(actor, key, rank) {
  const protocol = PROTOCOLS[key];
  const learnedRank = getProtocolRank(actor, key);
  if (!protocol || rank < 1 || rank > learnedRank) return;
  const ability = protocol.ranks.find((entry) => entry.rank === rank);
  if (!ability?.activation) return;

  const activation = ability.activation;
  let selection = null;
  let variable = null;

  if (Array.isArray(activation.choices)) {
    const options = activation.choices.map((choice) => `<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.label)} · ${choice.wp} WP / ${choice.overload ?? choice.wp} OL</option>`).join("");
    const result = await legacyPrompt({
      title: ability.name,
      content: `<div class="fbm-dialog"><label>${localize("ActivationMode", "Режим активации")}<select name="mode">${options}</select></label></div>`,
      buttons: {
        ok: { label: localize("Activate", "Активировать"), callback: (html) => readDialogValue(html, "select[name='mode']") },
        cancel: { label: localize("Cancel", "Отмена"), callback: () => null }
      }
    });
    if (!result) return;
    selection = result;
  } else if (activation.mode === "variable" || activation.mode === "variable-rank") {
    const max = activation.mode === "variable-rank"
      ? learnedRank
      : Math.min(Number(activation.max) || 10, Math.max(1, Number(actor.system?.bio?.willpower?.value) || 0));
    const result = await legacyPrompt({
      title: ability.name,
      content: `<div class="fbm-dialog"><label>${localize("SpendWP", "Потратить WP")}<input type="number" name="value" min="${activation.min ?? 1}" max="${max}" value="1"></label></div>`,
      buttons: {
        ok: { label: localize("Activate", "Активировать"), callback: (html) => Number(readDialogValue(html, "input[name='value']")) },
        cancel: { label: localize("Cancel", "Отмена"), callback: () => null }
      }
    });
    if (!result) return;
    variable = result;
  }

  const cost = calculateActivationCost(actor, key, activation, selection, variable);
  if (!cost) return;
  if (!(await spendWillpower(actor, cost.wp))) return;

  const state = getMortarState(actor);
  const heatExtra = state.thermal === "heat" ? 1 : 0;
  await adjustOverload(actor, cost.overload + heatExtra, { reason: `${protocol.name}: ${ability.name}` });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fbm-chat"><h3>${escapeHtml(ability.name)}</h3><p>${escapeHtml(actor.name)}: -${cost.wp} WP, +${cost.overload + heatExtra} OVERLOAD${heatExtra ? " (HEAT +1)" : ""}.</p><p>${escapeHtml(ability.description)}</p></div>`
  });
}

export async function triggerPassive(actor, key) {
  const protocol = PROTOCOLS[key];
  if (!protocol?.passive || !canUsePassive(actor, key)) return;
  const state = getMortarState(actor);
  if (state.passive !== key) {
    ui.notifications.warn(localize("PassiveNotActive", "Этот пассивный протокол не активен."));
    return;
  }
  if (protocol.passive.trigger !== "wp-die") return;
  const rank = getProtocolRank(actor, key);
  const amount = rank <= 1 ? 1 : (await new Roll(`1d${rank}`).evaluate()).total;
  await gainWillpower(actor, amount, protocol.passive.name);
}

export async function performReboot(actor) {
  const known = knownOperationalProtocols(actor);
  const state = getMortarState(actor);
  const options = [
    `<option value="">${localize("KeepPassive", "Не менять пассивный протокол")}</option>`,
    ...known.map((key) => `<option value="${key}" ${state.passive === key ? "selected" : ""}>${escapeHtml(PROTOCOLS[key].passive?.name ?? PROTOCOLS[key].name)}</option>`)
  ].join("");

  const choice = await legacyPrompt({
    title: "REBOOT",
    content: `<div class="fbm-dialog"><p>${localize("RebootHint", "Quarter Day. +1 WITS, +1 EMPATHY, OVERLOAD → 0. Можно сменить активный пассивный Operational Protocol.")}</p><label>${localize("PassiveProtocol", "Пассивный протокол")}<select name="passive">${options}</select></label></div>`,
    buttons: {
      ok: { label: "REBOOT", callback: (html) => String(readDialogValue(html, "select[name='passive']") ?? "") },
      cancel: { label: localize("Cancel", "Отмена"), callback: () => null }
    }
  });
  if (choice === null) return;

  const wits = actor.system?.attribute?.wits;
  const empathy = actor.system?.attribute?.empathy;
  const update = {};
  if (wits) update["system.attribute.wits.value"] = Math.min(Number(wits.max) || 0, (Number(wits.value) || 0) + 1);
  if (empathy) update["system.attribute.empathy.value"] = Math.min(Number(empathy.max) || 0, (Number(empathy.value) || 0) + 1);
  if (Object.keys(update).length) await actor.update(update, { render: false });

  const patch = {
    overload: 0,
    psychosis: { active: false, remainingRounds: 0 }
  };
  if (choice && canUsePassive(actor, choice)) patch.passive = choice;
  await setMortarState(actor, patch);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fbm-chat"><h3>REBOOT</h3><p>${escapeHtml(actor.name)}: WITS +1, EMPATHY +1, OVERLOAD → 0.</p>${choice ? `<p>PASSIVE: ${escapeHtml(PROTOCOLS[choice].passive?.name ?? choice)}</p>` : ""}</div>`
  });
}

export async function performMaintenance(actor) {
  const roll = await new Roll("1d6").evaluate();
  const state = getMortarState(actor);
  const reduction = Math.min(state.overload, roll.total);
  await adjustOverload(actor, -reduction, { triggerPsychosis: false });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `MAINTENANCE · OVERLOAD -${reduction}`
  });
}

export async function performCoolingTurn(actor) {
  const state = getMortarState(actor);
  const amount = state.thermal === "cold" ? 2 : state.thermal === "heat" ? 0 : 1;
  if (!amount) {
    ui.notifications.info(localize("HeatNoCooling", "HEAT: естественное снижение OVERLOAD не происходит."));
    return;
  }
  await adjustOverload(actor, -amount, { triggerPsychosis: false });
}

export async function endPsychosisRound(actor) {
  const state = getMortarState(actor);
  if (!state.psychosis.active) return;
  const remaining = Math.max(0, state.psychosis.remainingRounds - 1);
  if (remaining > 0) {
    await setMortarState(actor, { psychosis: { active: true, remainingRounds: remaining } });
    return;
  }

  const reductionRoll = await new Roll("1d6").evaluate();
  const max = getMaxOverload(actor);
  const nextOverload = Math.max(0, state.overload - reductionRoll.total);

  if (nextOverload >= max) {
    const durationRoll = await new Roll("1d3").evaluate();
    await setMortarState(actor, {
      overload: nextOverload,
      psychosis: { active: true, remainingRounds: durationRoll.total }
    });
    await reductionRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `PSYCHOSIS CYCLE · OVERLOAD -${reductionRoll.total} · ${nextOverload}/${max}`
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fbm-chat"><h3>PSYCHOSIS CONTINUES</h3><p><strong>${escapeHtml(actor.name)}</strong>: OVERLOAD ${nextOverload}/${max}. Новый цикл: ${durationRoll.total} раунд(а).</p></div>`
    });
    return;
  }

  await setMortarState(actor, {
    overload: nextOverload,
    psychosis: { active: false, remainingRounds: 0 }
  });
  await reductionRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `PSYCHOSIS END · OVERLOAD -${reductionRoll.total} · ${nextOverload}/${max}`
  });
}

export async function setThermalMode(actor, mode) {
  if (!new Set(["cold", "normal", "heat"]).has(mode)) return;
  await setMortarState(actor, { thermal: mode });
}

export async function setAwakeningDate(actor, value) {
  await setMortarState(actor, { awakeningDate: String(value ?? "") }, { render: false });
}

export async function setStructuralDamage(actor, attribute, value, { render = true } = {}) {
  if (!new Set(["strength", "agility"]).has(attribute)) return;
  const state = getMortarState(actor);
  const damage = Math.max(0, Math.trunc(Number(value) || 0));
  const structuralDamage = { ...state.structuralDamage, [attribute]: damage };
  await setMortarState(actor, { structuralDamage }, { render: false });

  const attr = actor.system?.attribute?.[attribute];
  if (attr) {
    const effectiveMax = Math.max(0, (Number(attr.max) || 0) - damage);
    if ((Number(attr.value) || 0) > effectiveMax) {
      await actor.update({ [`system.attribute.${attribute}.value`]: effectiveMax }, { render: false });
    }
  }
  if (render) scheduleActorSheetRender(actor);
}

export async function initializeParts(actor) {
  const count = await initializeStartingParts(actor);
  if (count) ui.notifications.info(localize("PartsInitialized", "Стартовые запчасти добавлены в инвентарь."));
  else ui.notifications.info(localize("PartsAlreadyExist", "Запчасти уже существуют."));
}

export async function adjustPartsDie(actor, type, direction) {
  const item = getParts(actor, type);
  if (!item) return;
  const current = getPartsDie(item);
  const index = RESOURCE_DIE_STEPS.indexOf(current);
  const nextIndex = Math.max(-1, Math.min(RESOURCE_DIE_STEPS.length - 1, index + direction));
  const next = nextIndex < 0 ? 0 : RESOURCE_DIE_STEPS[nextIndex];
  await setPartsDie(item, next);
}

export async function rollRepair(actor, { type = "common", attribute = "strength" } = {}) {
  const parts = getParts(actor, type);
  const die = getPartsDie(parts);
  if (!parts || !die) {
    ui.notifications.warn(localize("NoParts", "Нет подходящих запчастей с Resource Die."));
    return;
  }

  const attr = actor.system?.attribute?.strength;
  const skill = actor.system?.skill?.crafting;
  if (!attr || !skill || typeof game.fbl?.roll !== "function") {
    ui.notifications.error(localize("RollUnavailable", "Не удалось открыть системный CRAFTING roll."));
    return;
  }

  const label = type === "precision" ? "Точные запчасти" : "Обычные запчасти";
  const data = {
    title: `CRAFTING · ${label}`,
    attribute: { name: "strength", label: attr.label ?? "STR", value: Number(attr.value) || 0 },
    skill: { name: "crafting", label: skill.label ?? "CRAFTING", value: Number(skill.value) || 0 },
    gear: { label, name: label, value: 0, artifactDie: `d${die}` }
  };
  const options = {
    ...(actor.getRollContext?.() ?? {}),
    modifiers: actor.getRollModifierOptions?.("crafting", "strength") ?? [],
    gears: actor.items?.filter?.((item) => item.type === "gear" && !item.isBroken) ?? []
  };

  await game.fbl.roll(data, options);

  const degrade = await legacyPrompt({
    title: localize("ResourceDie", "Resource Die"),
    content: `<div class="fbm-dialog"><p>${localize("ResourceDiePrompt", "После разрешения броска: если Resource Die показал 1–2, понизь его на одну ступень.")}</p><p><strong>${escapeHtml(label)}: D${die}</strong></p></div>`,
    buttons: {
      degrade: { label: localize("Degrade", "Выпало 1–2: понизить"), callback: () => true },
      keep: { label: localize("Keep", "Оставить"), callback: () => false }
    },
    defaultButton: "keep"
  });
  if (degrade) await setPartsDie(parts, downgradeResourceDie(die));
}

export async function applyRepairResult(actor, { type = "common", attribute = "strength" } = {}) {
  const state = getMortarState(actor);
  const structural = Number(state.structuralDamage?.[attribute]) || 0;
  const attr = actor.system?.attribute?.[attribute];
  if (!attr) return;

  const successes = await legacyPrompt({
    title: localize("ApplyRepair", "Применить ремонт"),
    content: `<div class="fbm-dialog"><label>${localize("RepairSuccesses", "Количество успехов")}<input type="number" name="successes" min="0" value="1"></label></div>`,
    buttons: {
      ok: { label: localize("Apply", "Применить"), callback: (html) => Number(readDialogValue(html, "input[name='successes']")) },
      cancel: { label: localize("Cancel", "Отмена"), callback: () => null }
    }
  });
  if (successes === null) return;
  let remaining = Math.max(0, Math.trunc(successes));

  if (type === "precision") {
    const repairedStructural = Math.min(structural, remaining);
    remaining -= repairedStructural;
    const newStructural = structural - repairedStructural;
    const normalMax = Number(attr.max) || 0;
    const current = Number(attr.value) || 0;
    const nextValue = Math.min(normalMax - newStructural, current + repairedStructural);
    await setStructuralDamage(actor, attribute, newStructural, { render: false });
    await actor.update({ [`system.attribute.${attribute}.value`]: Math.max(0, nextValue) }, { render: false });
    scheduleActorSheetRender(actor);
    return;
  }

  const current = Number(attr.value) || 0;
  const normalMax = Number(attr.max) || 0;
  const temporaryMax = Math.max(0, normalMax - structural);
  const next = Math.min(temporaryMax, current + remaining);
  await actor.update({ [`system.attribute.${attribute}.value`]: next }, { render: false });

  if (next < temporaryMax) {
    const newStructural = Math.max(structural, normalMax - next);
    await setStructuralDamage(actor, attribute, newStructural);
  } else {
    await setStructuralDamage(actor, attribute, structural);
  }
}

export function getServiceSummary(actor) {
  const state = getMortarState(actor);
  return {
    state,
    band: getOverloadBand(actor, state),
    armor: getIntegratedArmor(actor, state),
    common: { item: getParts(actor, "common"), die: getPartsDie(getParts(actor, "common")) },
    precision: { item: getParts(actor, "precision"), die: getPartsDie(getParts(actor, "precision")) }
  };
}

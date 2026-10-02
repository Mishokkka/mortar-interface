import {
  FLAG_PARTS_DIE,
  FLAG_PARTS_TYPE,
  FLAG_STATE,
  IMMUNE_CONDITIONS,
  MODULE_ID,
  MORTAR_NAMES,
  OPERATIONAL_PROTOCOL_KEYS,
  RESOURCE_DIE_STEPS,
  THERMAL_MODES
} from "./constants.js";
import { PROTOCOLS, PROTOCOL_ALIASES } from "./protocol-data.js";

export function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[ё]/gu, "е")
    .replace(/[\s_-]+/gu, " ");
}

export function isMortarTalent(item) {
  if (!item || item.type !== "talent") return false;
  const name = normalizeName(item.name);
  return MORTAR_NAMES.some((candidate) => normalizeName(candidate) === name);
}

export function isMortarActor(actor) {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return false;
  return actor.items?.some?.(isMortarTalent) ?? false;
}

export function defaultState() {
  return {
    version: 1,
    overload: 0,
    thermal: "normal",
    passive: null,
    operationalOrder: [],
    awakeningDate: "",
    structuralDamage: {
      strength: 0,
      agility: 0
    },
    psychosis: {
      active: false,
      remainingRounds: 0
    },
    lastOverloadAt: 0
  };
}

export function getMortarState(actor) {
  const raw = actor?.getFlag?.(MODULE_ID, FLAG_STATE) ?? {};
  const base = defaultState();
  const state = foundry.utils.mergeObject(base, foundry.utils.deepClone(raw), {
    inplace: false,
    insertKeys: true,
    overwrite: true
  });

  if (!state.structuralDamage || typeof state.structuralDamage !== "object" || Array.isArray(state.structuralDamage)) {
    state.structuralDamage = { strength: 0, agility: 0 };
  }
  if (!state.psychosis || typeof state.psychosis !== "object" || Array.isArray(state.psychosis)) {
    state.psychosis = { active: false, remainingRounds: 0 };
  }

  state.overload = Math.max(0, Math.trunc(Number(state.overload) || 0));
  state.thermal = THERMAL_MODES.includes(state.thermal) ? state.thermal : "normal";
  state.passive = OPERATIONAL_PROTOCOL_KEYS.includes(state.passive) ? state.passive : null;
  state.operationalOrder = [...new Set((Array.isArray(state.operationalOrder) ? state.operationalOrder : []).filter((key) => OPERATIONAL_PROTOCOL_KEYS.includes(key)))];
  state.awakeningDate = String(state.awakeningDate ?? "");
  state.structuralDamage.strength = Math.max(0, Math.trunc(Number(state.structuralDamage?.strength) || 0));
  state.structuralDamage.agility = Math.max(0, Math.trunc(Number(state.structuralDamage?.agility) || 0));
  state.psychosis.active = Boolean(state.psychosis?.active);
  state.psychosis.remainingRounds = Math.max(0, Math.trunc(Number(state.psychosis?.remainingRounds) || 0));
  state.lastOverloadAt = Number(state.lastOverloadAt) || 0;
  return state;
}

export async function setMortarState(actor, patch, { render = true } = {}) {
  const current = getMortarState(actor);
  const next = foundry.utils.mergeObject(current, foundry.utils.deepClone(patch), {
    inplace: false,
    insertKeys: true,
    overwrite: true
  });
  await actor.update({ [`flags.${MODULE_ID}.${FLAG_STATE}`]: next }, { render: false });
  refreshQuickAccess(actor);
  if (render) scheduleActorSheetRender(actor);
  return next;
}

export function getProtocolItem(actor, key) {
  const aliases = (PROTOCOL_ALIASES[key] ?? []).map(normalizeName);
  const canonical = normalizeName(PROTOCOLS[key]?.name);
  return actor?.items?.find?.((item) => {
    if (item.type !== "talent") return false;
    const name = normalizeName(item.name);
    return name === canonical || aliases.includes(name) || item.getFlag?.(MODULE_ID, "protocolKey") === key;
  }) ?? null;
}

export function getProtocolRank(actor, key) {
  const item = getProtocolItem(actor, key);
  return Math.max(0, Math.min(5, Math.trunc(Number(item?.system?.rank) || 0)));
}

export function getProtocolSnapshot(actor) {
  const out = {};
  for (const key of Object.keys(PROTOCOLS)) {
    const item = getProtocolItem(actor, key);
    out[key] = {
      key,
      item,
      rank: Math.max(0, Math.min(5, Math.trunc(Number(item?.system?.rank) || 0)))
    };
  }
  return out;
}

export function getMaxOverload(actor) {
  const witsMax = Math.max(0, Number(actor?.system?.attribute?.wits?.max) || 0);
  return Math.max(1, Math.trunc(witsMax * 2 + (getProtocolRank(actor, "recovery") >= 5 ? 2 : 0)));
}

export function getOverloadBand(actor, state = getMortarState(actor)) {
  const max = getMaxOverload(actor);
  const value = Math.max(0, Number(state.overload) || 0);
  const ratio = value / max;
  if (value >= max) return { key: "psychosis", label: "PSYCHOSIS", ratio, max };
  if (ratio >= 0.75) return { key: "critical", label: "CRITICAL", ratio, max };
  if (ratio > 0.5) return { key: "heightened", label: "HEIGHTENED", ratio, max };
  return { key: "stable", label: "STABLE", ratio, max };
}

export function isHeightened(actor, state = getMortarState(actor)) {
  const band = getOverloadBand(actor, state);
  return band.key === "heightened" || band.key === "critical" || band.key === "psychosis";
}

export function isCriticalOverload(actor, state = getMortarState(actor)) {
  const band = getOverloadBand(actor, state);
  return band.key === "critical" || band.key === "psychosis";
}

export function getIntegratedArmor(actor, state = getMortarState(actor)) {
  return state.passive === "bulwark" && getProtocolRank(actor, "bulwark") >= 1 ? 4 : 2;
}

export function canUsePassive(actor, key) {
  return OPERATIONAL_PROTOCOL_KEYS.includes(key) && getProtocolRank(actor, key) >= 1;
}

export function knownOperationalProtocols(actor) {
  return OPERATIONAL_PROTOCOL_KEYS.filter((key) => getProtocolRank(actor, key) >= 1);
}

export function getParts(actor, type) {
  return actor?.items?.find?.((item) => item.getFlag?.(MODULE_ID, FLAG_PARTS_TYPE) === type) ?? null;
}

export function getPartsDie(item) {
  const die = Number(item?.getFlag?.(MODULE_ID, FLAG_PARTS_DIE));
  return RESOURCE_DIE_STEPS.includes(die) ? die : 0;
}

export async function setPartsDie(item, die) {
  if (!item) return;
  const normalized = RESOURCE_DIE_STEPS.includes(Number(die)) ? Number(die) : 0;
  await item.setFlag(MODULE_ID, FLAG_PARTS_DIE, normalized);
}

export function downgradeResourceDie(die) {
  const index = RESOURCE_DIE_STEPS.indexOf(Number(die));
  if (index <= 0) return 0;
  return RESOURCE_DIE_STEPS[index - 1];
}

export async function initializeStartingParts(actor) {
  const creations = [];
  if (!getParts(actor, "common")) {
    creations.push({
      name: "Обычные запчасти",
      type: "rawMaterial",
      img: "icons/commodities/tech/cog-brass.webp",
      system: { quantity: 1 },
      flags: { [MODULE_ID]: { [FLAG_PARTS_TYPE]: "common", [FLAG_PARTS_DIE]: 10 } }
    });
  }
  if (!getParts(actor, "precision")) {
    creations.push({
      name: "Точные запчасти",
      type: "rawMaterial",
      img: "icons/commodities/tech/cog-steel.webp",
      system: { quantity: 1 },
      flags: { [MODULE_ID]: { [FLAG_PARTS_TYPE]: "precision", [FLAG_PARTS_DIE]: 8 } }
    });
  }
  if (creations.length) await actor.createEmbeddedDocuments("Item", creations);
  return creations.length;
}

const RENDER_QUEUE = new WeakSet();

export function scheduleActorSheetRender(actor) {
  if (!actor || RENDER_QUEUE.has(actor)) return;
  RENDER_QUEUE.add(actor);
  window.setTimeout(() => {
    RENDER_QUEUE.delete(actor);
    const apps = Object.values(actor.apps ?? {});
    for (const app of apps) {
      if (app?.rendered) app.render(false);
    }
  }, 0);
}

export function refreshQuickAccess(actor) {
  try {
    const qa = game.modules.get("fbl-quick-access")?.api;
    qa?.refreshStat?.(actor);
  } catch (error) {
    console.warn(`${MODULE_ID} | Quick Access STAT refresh failed`, error);
  }
}

export async function clearBiologicalConditions(actor) {
  if (!isMortarActor(actor)) return;
  const update = {};
  for (const condition of IMMUNE_CONDITIONS) {
    if (actor.system?.condition?.[condition]?.value) {
      update[`system.condition.${condition}.value`] = false;
    }
  }
  if (Object.keys(update).length) await actor.update(update);

  const effectIds = actor.effects
    ?.filter?.((effect) => {
      const statuses = new Set(Array.from(effect.statuses ?? []));
      const legacy = effect.getFlag?.("core", "statusId");
      return IMMUNE_CONDITIONS.some((condition) => statuses.has(condition) || legacy === condition);
    })
    ?.map?.((effect) => effect.id) ?? [];
  if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
}


export function clampStructuralAttributeUpdates(actor, changes) {
  if (!actor || !changes || typeof changes !== "object") return;
  const state = getMortarState(actor);

  for (const attribute of ["strength", "agility"]) {
    const currentData = actor.system?.attribute?.[attribute];
    if (!currentData) continue;

    const flatMaxKey = `system.attribute.${attribute}.max`;
    const flatValueKey = `system.attribute.${attribute}.value`;
    const nested = changes.system?.attribute?.[attribute];
    const proposedMaxRaw = changes[flatMaxKey] ?? nested?.max ?? currentData.max;
    const normalMax = Math.max(0, Number(proposedMaxRaw) || 0);
    const structural = Math.max(0, Number(state.structuralDamage?.[attribute]) || 0);
    const effectiveMax = Math.max(0, normalMax - structural);

    if (changes[flatValueKey] !== undefined) {
      changes[flatValueKey] = Math.max(0, Math.min(effectiveMax, Number(changes[flatValueKey]) || 0));
    }
    if (nested?.value !== undefined) {
      nested.value = Math.max(0, Math.min(effectiveMax, Number(nested.value) || 0));
    }
  }
}

export function stripImmuneConditionUpdates(changes) {
  if (!changes || typeof changes !== "object") return;
  for (const condition of IMMUNE_CONDITIONS) {
    const flatKey = `system.condition.${condition}.value`;
    if (changes[flatKey] === true || changes[flatKey] === 1 || changes[flatKey] === "true") delete changes[flatKey];

    const nested = changes.system?.condition?.[condition];
    if (nested && (nested.value === true || nested.value === 1 || nested.value === "true")) {
      delete changes.system.condition[condition];
    }
  }
}

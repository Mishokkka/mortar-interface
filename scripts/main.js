import { IMMUNE_CONDITIONS, MODULE_ID } from "./constants.js";
import { initializeQuickAccessIntegration } from "./quick-access.js";
import { installRollIntegration } from "./roll-integration.js";
import {
  clampStructuralAttributeUpdates,
  clearBiologicalConditions,
  getMortarState,
  getOverloadBand,
  isMortarActor,
  isMortarTalent,
  scheduleActorSheetRender,
  stripImmuneConditionUpdates
} from "./state.js";
import { adjustOverload, performMaintenance, performReboot } from "./actions.js";
import { releaseMortarSheet, scheduleMortarMount } from "./ui.js";
import { registerMortarSettings } from "./settings.js";

Hooks.once("init", () => {
  registerMortarSettings();

  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = Object.freeze({
    apiVersion: 1,
    isMortarActor,
    getMortarState,
    getOverloadBand,
    adjustOverload,
    performReboot,
    performMaintenance
  });
  Hooks.callAll("fblMortarInterface.apiReady", module.api);
});

Hooks.once("ready", async () => {
  installRollIntegration();
  initializeQuickAccessIntegration();

  // Actors that already had Mechanical Body before the module was enabled may
  // still carry biological condition effects. Clear them once on startup.
  for (const actor of game.actors?.contents ?? []) {
    if (!actor?.isOwner || !isMortarActor(actor)) continue;
    try {
      await clearBiologicalConditions(actor);
    } catch (error) {
      console.warn(`${MODULE_ID} | failed to clear biological conditions for ${actor.name}`, error);
    }
  }

  console.log(`${MODULE_ID} | ready for Foundry ${game.version}, Forbidden Lands ${game.system.version}`);
});

Hooks.on("renderActorSheet", (app, htmlOrElement) => scheduleMortarMount(app, htmlOrElement));
Hooks.on("closeActorSheet", (app) => releaseMortarSheet(app));

Hooks.on("preUpdateActor", (actor, changes) => {
  if (!isMortarActor(actor)) return;
  stripImmuneConditionUpdates(changes);
  clampStructuralAttributeUpdates(actor, changes);
});

Hooks.on("preCreateActiveEffect", (effect) => {
  const actor = effect.parent;
  if (!isMortarActor(actor)) return;
  const statuses = new Set(Array.from(effect.statuses ?? []));
  const legacy = effect.getFlag?.("core", "statusId") ?? effect._source?.flags?.core?.statusId;
  if (IMMUNE_CONDITIONS.some((condition) => statuses.has(condition) || legacy === condition)) {
    ui.notifications.info("Мортар невосприимчив к Hungry, Sleepy, Thirsty и Cold.");
    return false;
  }
});

Hooks.on("createItem", async (item) => {
  const actor = item.parent;
  if (actor?.documentName !== "Actor") return;
  if (isMortarTalent(item)) await clearBiologicalConditions(actor);
  if (isMortarActor(actor)) scheduleActorSheetRender(actor);
});

Hooks.on("updateItem", async (item, changes) => {
  const actor = item.parent;
  if (actor?.documentName !== "Actor") return;

  // Renaming a Talent can turn Mortar mode on or off. Always rerender character
  // sheets for Talent name changes, even when the new name is no longer the
  // Mechanical Body marker.
  if (item.type === "talent" && changes.name !== undefined) {
    if (isMortarTalent(item)) await clearBiologicalConditions(actor);
    scheduleActorSheetRender(actor);
    return;
  }

  if (!isMortarActor(actor)) return;
  if (changes.system?.rank !== undefined || changes["system.rank"] !== undefined || changes.flags?.[MODULE_ID] !== undefined) {
    scheduleActorSheetRender(actor);
  }
});

Hooks.on("deleteItem", (item) => {
  const actor = item.parent;
  if (actor?.documentName !== "Actor") return;
  if (isMortarActor(actor) || isMortarTalent(item)) scheduleActorSheetRender(actor);
});

Hooks.on("createChatMessage", (message) => {
  try {
    const authorId = message.author?.id ?? (typeof message.user === "string" ? message.user : message.user?.id) ?? message._source?.user;
    if (authorId !== game.user.id) return;
    const roll = message.rolls?.[0];
    if (!roll?.pushed) return;
    const actor = message.actor ?? game.actors.get(message.speaker?.actor);
    if (!isMortarActor(actor)) return;
    if (getOverloadBand(actor).key !== "critical") return;
    // CRITICAL OVERLOAD applies after the PUSH has resolved. The pushed chat
    // message is created only after FBLRollHandler.pushRoll() resolves the roll.
    void adjustOverload(actor, 1, { reason: "CRITICAL OVERLOAD · PUSH" });
  } catch (error) {
    console.error(`${MODULE_ID} | CRITICAL OVERLOAD push hook failed`, error);
  }
});

import { MODULE_ID } from "./constants.js";
import { getMortarState, getOverloadBand, isMortarActor } from "./state.js";

let unregisterStat = null;
let apiReadyHook = null;

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function registerWith(api) {
  if (!api?.capabilities?.statProviders || typeof api.registerStatProvider !== "function") return false;
  if (unregisterStat) return true;

  unregisterStat = api.registerStatProvider({
    id: MODULE_ID,
    order: 180,
    render({ actor }) {
      if (!isMortarActor(actor)) return "";
      const state = getMortarState(actor);
      const band = getOverloadBand(actor, state);
      return `
        <section class="fbm-qa-stat" data-fbm-qa-stat="true">
          <div class="fbm-qa-stat__head"><strong>MORTAR CORE</strong><span class="fbm-band fbm-band--${band.key}">${band.label}</span></div>
          <div class="fbm-qa-stat__grid">
            <span>OVERLOAD</span><strong>${state.overload}/${band.max}</strong>
            <span>STRUCT STR</span><strong>${state.structuralDamage.strength}</strong>
            <span>STRUCT AGI</span><strong>${state.structuralDamage.agility}</strong>
            <span>THERMAL</span><strong>${escapeHtml(state.thermal.toUpperCase())}</strong>
          </div>
        </section>`;
    }
  });
  return true;
}

export function initializeQuickAccessIntegration() {
  const api = game.modules.get("fbl-quick-access")?.api;
  if (registerWith(api)) return;
  apiReadyHook = Hooks.on("fblQuickAccess.apiReady", (readyApi) => registerWith(readyApi));
}

export function shutdownQuickAccessIntegration() {
  try { unregisterStat?.(); } catch (_) { /* noop */ }
  unregisterStat = null;
  if (apiReadyHook !== null) Hooks.off("fblQuickAccess.apiReady", apiReadyHook);
  apiReadyHook = null;
}

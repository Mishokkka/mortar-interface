import { MODULE_ID } from "./constants.js";
import { getIntegratedArmor, getMortarState, isHeightened, isMortarActor } from "./state.js";
import { performReboot } from "./actions.js";

const PATCH_MARK = Symbol.for(`${MODULE_ID}.getRollModifierOptions`);
const REST_PATCH_MARK = Symbol.for(`${MODULE_ID}.rest`);

export function installRollIntegration() {
  const cls = CONFIG.Actor?.documentClass;
  const proto = cls?.prototype;
  if (!proto || typeof proto.getRollModifierOptions !== "function") {
    console.warn(`${MODULE_ID} | Forbidden Lands Actor#getRollModifierOptions not found; roll modifiers disabled.`);
    return;
  }
  if (typeof proto.rest === "function" && !proto[REST_PATCH_MARK]) {
    const originalRest = proto.rest;
    Object.defineProperty(proto, REST_PATCH_MARK, { value: originalRest, configurable: true });
    proto.rest = function (...args) {
      if (isMortarActor(this)) return performReboot(this);
      return originalRest.apply(this, args);
    };
  }

  if (proto[PATCH_MARK]) return;

  const original = proto.getRollModifierOptions;
  Object.defineProperty(proto, PATCH_MARK, { value: original, configurable: true });

  proto.getRollModifierOptions = function (...identifiers) {
    const base = original.apply(this, identifiers) ?? [];
    if (!isMortarActor(this)) return base;

    const modifiers = Array.from(base);
    const state = getMortarState(this);
    const ids = new Set(identifiers.map((value) => String(value ?? "").toLocaleLowerCase()));

    if (isHeightened(this, state)) {
      let value = 0;
      if (ids.has("strength") || ids.has("agility")) value = 1;
      else if (ids.has("wits") || ids.has("empathy")) value = -1;
      if (value) {
        modifiers.push({
          name: "OVERLOAD · HEIGHTENED STATE",
          value: String(value),
          active: true,
          id: `${MODULE_ID}:heightened`,
          type: "mortar"
        });
      }
    }

    // FBL v13.0.5 passes equipped armor Item IDs together with the "armor"
    // identifier for the TOTAL armor roll. Restricting this to a single
    // identifier silently drops the innate chassis as soon as worn armor exists.
    // The chassis is permanent actor armor, so it participates in every armor
    // roll, including a manually rolled specific armor piece.
    if (ids.has("armor")) {
      modifiers.push({
        name: "MORTAR · INTEGRATED CHASSIS",
        value: String(getIntegratedArmor(this, state)),
        active: true,
        id: `${MODULE_ID}:armor`,
        type: "mortar"
      });
    }

    return modifiers;
  };
}

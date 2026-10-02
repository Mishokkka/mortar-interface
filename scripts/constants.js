export const MODULE_ID = "fbl-mortar-interface";
export const MODULE_TITLE = "FBL Mortar Interface";

export const FLAG_STATE = "state";
export const FLAG_PARTS_TYPE = "partsType";
export const FLAG_PARTS_DIE = "resourceDie";
export const FLAG_MECHANICAL_INJURY = "mechanicalInjury";

// Mortar mode is detected by the racial talent Mechanical Body.
export const MORTAR_NAMES = Object.freeze([
  "механическое тело",
  "mechanical body"
]);

export const PROTOCOL_KEYS = Object.freeze([
  "recovery",
  "combat",
  "bulwark",
  "reconnaissance",
  "engineering",
  "mobility",
  "command"
]);

export const OPERATIONAL_PROTOCOL_KEYS = Object.freeze([
  "combat",
  "bulwark",
  "reconnaissance",
  "engineering",
  "mobility",
  "command"
]);

export const RESOURCE_DIE_STEPS = Object.freeze([6, 8, 10, 12]);
export const IMMUNE_CONDITIONS = Object.freeze(["hungry", "sleepy", "thirsty", "cold"]);
export const THERMAL_MODES = Object.freeze(["cold", "normal", "heat"]);

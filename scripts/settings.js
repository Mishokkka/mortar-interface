import { MODULE_ID } from "./constants.js";

export const INTERFACE_THEMES = Object.freeze([
  "matrix",
  "amber",
  "cyan",
  "redline",
  "paper",
  "ivory",
  "frost",
  "custom"
]);

const CUSTOM_THEME_DEFAULTS = Object.freeze({
  background: "#f2efe6",
  backgroundDeep: "#e4ddd1",
  panel: "#fbf8f1",
  panel2: "#efe8da",
  panel3: "#e6ded0",
  line: "#7d7668",
  lineStrong: "#3f3a31",
  text: "#2d2822",
  textBright: "#17130f",
  dim: "#62594f",
  lamp: "#225a3d",
  warning: "#846100",
  critical: "#af5a00",
  danger: "#9d232f"
});

function normalizeTheme(value) {
  return INTERFACE_THEMES.includes(value) ? value : "matrix";
}

function normalizeHexColor(value, fallback) {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/iu.test(text)) return text;
  if (/^#[0-9a-f]{3}$/iu.test(text)) return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  return fallback;
}

function hexToRgb(hex) {
  const safe = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function rgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getInterfaceTheme() {
  try {
    return normalizeTheme(game.settings.get(MODULE_ID, "interfaceTheme"));
  } catch (_error) {
    return "matrix";
  }
}

export function getCustomThemeConfig() {
  const config = {};
  for (const [key, fallback] of Object.entries(CUSTOM_THEME_DEFAULTS)) {
    try {
      config[key] = normalizeHexColor(game.settings.get(MODULE_ID, `customTheme${key[0].toUpperCase()}${key.slice(1)}`), fallback);
    } catch (_error) {
      config[key] = fallback;
    }
  }
  return config;
}

export function getCustomThemeVars() {
  const cfg = getCustomThemeConfig();
  return {
    "--fbm-bg": cfg.background,
    "--fbm-bg-deep": cfg.backgroundDeep,
    "--fbm-panel": cfg.panel,
    "--fbm-panel-2": cfg.panel2,
    "--fbm-panel-3": cfg.panel3,
    "--fbm-line": cfg.line,
    "--fbm-line-strong": cfg.lineStrong,
    "--fbm-line-soft": rgba(cfg.lineStrong, 0.18),
    "--fbm-text": cfg.text,
    "--fbm-text-bright": cfg.textBright,
    "--fbm-dim": cfg.dim,
    "--fbm-lamp": cfg.lamp,
    "--fbm-warning": cfg.warning,
    "--fbm-critical": cfg.critical,
    "--fbm-danger": cfg.danger,
    "--fbm-ink": cfg.background,
    "--fbm-glow": rgba(cfg.lamp, 0.20),
    "--fbm-scanline": rgba(cfg.lineStrong, 0.03),
    "--fbm-selection": rgba(cfg.lamp, 0.18),
    "--fbm-field-bg": rgba(cfg.panel2, 0.92),
    "--fbm-field-bg-2": rgba(cfg.panel, 0.96),
    "--fbm-panel-muted": rgba(cfg.panel2, 0.80),
    "--fbm-row-odd": rgba(cfg.panel2, 0.36),
    "--fbm-row-even": rgba(cfg.panel3, 0.54),
    "--fbm-dialog-overlay": rgba(cfg.backgroundDeep, 0.72)
  };
}

export function applyThemeClass(element, theme = getInterfaceTheme()) {
  if (!(element instanceof HTMLElement)) return;
  const normalized = normalizeTheme(theme);
  for (const key of INTERFACE_THEMES) element.classList.remove(`fbm-theme-${key}`);
  element.classList.add(`fbm-theme-${normalized}`);
  if (normalized === "custom") {
    for (const [name, value] of Object.entries(getCustomThemeVars())) element.style.setProperty(name, value);
  } else {
    for (const name of Object.keys(getCustomThemeVars())) element.style.removeProperty(name);
  }
}

export function applyThemeToOpenSheets(theme) {
  const normalized = normalizeTheme(theme);
  for (const element of document.querySelectorAll(".fbm-mortar-window, .fbm-mortar-sheet, .fbm-mortar-dialog-window, .fbm-qa-stat")) {
    applyThemeClass(element, normalized);
  }
}

export function registerMortarSettings() {
  const t = (key) => game.i18n.localize(key);
  game.settings.register(MODULE_ID, "interfaceTheme", {
    name: t("fbl-mortar-interface.Settings.Theme.Name"),
    hint: t("fbl-mortar-interface.Settings.Theme.Hint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      matrix: t("fbl-mortar-interface.Settings.Theme.Matrix"),
      amber: t("fbl-mortar-interface.Settings.Theme.Amber"),
      cyan: t("fbl-mortar-interface.Settings.Theme.Cyan"),
      redline: t("fbl-mortar-interface.Settings.Theme.Redline"),
      paper: t("fbl-mortar-interface.Settings.Theme.Paper"),
      ivory: t("fbl-mortar-interface.Settings.Theme.Ivory"),
      frost: t("fbl-mortar-interface.Settings.Theme.Frost"),
      custom: t("fbl-mortar-interface.Settings.Theme.Custom")
    },
    default: "matrix",
    onChange: (value) => applyThemeToOpenSheets(value)
  });

  const colorKeys = [
    ["Background", "Background"],
    ["BackgroundDeep", "BackgroundDeep"],
    ["Panel", "Panel"],
    ["Panel2", "Panel2"],
    ["Panel3", "Panel3"],
    ["Line", "Line"],
    ["LineStrong", "LineStrong"],
    ["Text", "Text"],
    ["TextBright", "TextBright"],
    ["Dim", "Dim"],
    ["Lamp", "Lamp"],
    ["Warning", "Warning"],
    ["Critical", "Critical"],
    ["Danger", "Danger"]
  ];

  for (const [suffix, key] of colorKeys) {
    const settingKey = `customTheme${suffix}`;
    const defaultValue = CUSTOM_THEME_DEFAULTS[key[0].toLowerCase() + key.slice(1)];
    game.settings.register(MODULE_ID, settingKey, {
      name: t(`fbl-mortar-interface.Settings.Custom.${suffix}.Name`),
      hint: t(`fbl-mortar-interface.Settings.Custom.${suffix}.Hint`),
      scope: "client",
      config: true,
      type: String,
      default: defaultValue,
      onChange: () => {
        if (getInterfaceTheme() === "custom") applyThemeToOpenSheets("custom");
      }
    });
  }
}

/* global browser */

import Sidetab from "./sidetab.js";
import Tablist from "./tablist.js";
import Topmenu from "./topmenu.js";

import { TinyColor, readability } from "@ctrl/tinycolor";

// fallbacks for theme colors
const CSS_TO_THEME_PROPS = {
  "--background": ["frame"],
  "--button-background-active": ["button_background_active"],
  "--button-background-hover": ["button_background_hover"],
  "--icons": ["icons", "toolbar_text", "bookmark_text", "tab_background_text", "tab_text"],
  "--tab-separator": [
    "tab_background_separator",
    "toolbar_field_separator",
    "toolbar_top_separator",
  ],
  "--tab-selected-line": ["tab_line", "tab_text", "tab_background_text"],
  "--tab-loading-indicator": ["tab_loading"],
  "--tab-active-background": ["tab_selected", "toolbar"],
  "--tab-active-text": ["tab_text", "toolbar_text", "bookmark_text", "tab_background_text"],
  "--tab-text": ["tab_background_text", "tab_text", "toolbar_text", "bookmark_text"],
  "--toolbar-background": ["toolbar", "frame"],
  "--toolbar-text": ["toolbar_text", "bookmark_text"],
  "--input-background": ["toolbar_field"],
  "--input-border": ["toolbar_field_border"],
  "--input-border-focus": ["toolbar_field_border_focus"],
  "--input-background-focus": ["toolbar_field_focus"],
  "--input-selected-text-background": ["toolbar_field_highlight", "button_background_active"],
  "--input-selected-text": ["toolbar_field_highlight_text", "toolbar_field_text"],
  "--input-text": ["bookmark_text", "toolbar_field_text"],
  "--input-text-focus": ["toolbar_field_text_focus", "toolbar_field_text"],
};

export default class Sidebar {
  async init() {
    const window = await browser.windows.getCurrent();
    document.body.classList.toggle("incognito", window.incognito);
    this._windowId = window.id;

    const platform = await browser.runtime.getPlatformInfo();
    document.body.setAttribute("platform", platform.os);

    const search = this._search.bind(this);
    this._topMenu = new Topmenu({ search });

    const prefs = await this._getPrefs();
    if (typeof prefs.compactMode === "string") {
      prefs.compactMode = parseInt(prefs.compactMode);
    }
    this._initPrefs(prefs);

    this._tablist = new Tablist({
      windowId: this._windowId,
      search,
      prefs,
    });

    browser.runtime.connect({ name: this._windowId.toString() });
    this._setupListeners();
  }

  _search(val) {
    this._tablist.filter(val);
    this._topMenu.updateSearch(val);
  }

  async _initPrefs(prefs) {
    this._customCSS = prefs.customCSS;
    this._useCustomCSS = prefs.useCustomCSS;
    this._applyCustomCSS();
    this._themeIntegrationEnabled = prefs.themeIntegration;
    this._theme = await browser.theme.getCurrent(this._windowId);
    this._applyTheme(this._theme);
  }

  _setupListeners() {
    browser.storage.onChanged.addListener(changes => {
      this._onStorageChanged(changes);
      this._tablist.onStorageChanged(changes);
    });

    if (browser.theme.onUpdated) {
      browser.theme.onUpdated.addListener(({ theme, windowId }) =>
        this._onThemeUpdated(theme, windowId),
      );
    }

    window.addEventListener("contextmenu", e => this._onContextMenu(e), false);
  }

  _onContextMenu(e) {
    const target = e.target;
    // Let the searchbox input and the tabs have a context menu.
    if (
      !(target && (target.id === "searchbox-input" || target.id.startsWith("newtab"))) &&
      !Sidetab.isTabEvent(e, false)
    ) {
      e.preventDefault();
    }
  }

  _onThemeUpdated(theme, windowId) {
    if (!windowId || windowId === this._windowId) {
      this._theme = theme;
      this._applyTheme(theme);
    }
  }

  _applyCustomCSS() {
    document.getElementById("customCSS").textContent = this._useCustomCSS ? this._customCSS : "";
  }

  async _getPrefs() {
    // migrate user settings from local storage to sync storage
    const localPrefs = await browser.storage.local.get();
    if (Object.keys(localPrefs).length !== 0) {
      // rename (typo) setting `compactModeMode` to `compactMode`
      localPrefs["compactMode"] = localPrefs["compactModeMode"];
      delete localPrefs["compactModeMode"];
      delete localPrefs["warnBeforeClosing"];

      browser.storage.sync.set(localPrefs);
      browser.storage.sync.remove("warnBeforeClosing");
      browser.storage.local.clear();
    }

    return browser.storage.sync.get({
      animations: true,
      themeIntegration: true,
      compactMode: 1 /* COMPACT_MODE_DYNAMIC */,
      compactPins: true,
      switchLastActiveTab: true,
      switchByScrolling: 0 /* SWITCH_BY_SCROLLING_WITH_CTRL */,
      notifyClosingManyTabs: true,
      useCustomCSS: true,
      customCSS: "",
    });
  }

  _onStorageChanged(changes) {
    const hasCustomCSSChanged = changes.hasOwnProperty("customCSS");
    const hasUseCustomCSSChanged = changes.hasOwnProperty("useCustomCSS");

    if (hasCustomCSSChanged) {
      this._customCSS = changes.customCSS.newValue;
    }
    if (hasUseCustomCSSChanged) {
      this._useCustomCSS = changes.useCustomCSS.newValue;
    }
    if (hasCustomCSSChanged || hasUseCustomCSSChanged) {
      this._applyCustomCSS();
    }
    if (changes.hasOwnProperty("themeIntegration")) {
      this._themeIntegrationEnabled = changes.themeIntegration.newValue;
      this._applyTheme(this._theme);
    }
  }

  _applyTheme(theme) {
    const style = document.body.style;

    // if theme integration is disabled or theme is not usable, remove css variables then return
    if (!this._themeIntegrationEnabled || (theme.images && !theme.colors["sidebar"])) {
      for (const cssVar of Object.keys(CSS_TO_THEME_PROPS)) {
        style.removeProperty(cssVar);
      }
      return;
    }

    // get the effective values we will be using
    const themeColors = {};
    for (const [cssVar, themeProps] of Object.entries(CSS_TO_THEME_PROPS)) {
      for (const prop of themeProps) {
        themeColors[cssVar] = null;
        if (!theme.colors) {
          break;
        }
        if (theme.colors[prop]) {
          themeColors[cssVar] = theme.colors[prop];
          break;
        }
      }
    }

    // swap background and tab-active-background colors if background is light
    if (
      themeColors["--background"] !== null &&
      new TinyColor(themeColors["--background"]).isLight()
    ) {
      if (themeColors["--tab-active-background"] !== null) {
        let tmp = themeColors["--background"];
        themeColors["--background"] = themeColors["--tab-active-background"];
        themeColors["--tab-active-background"] = tmp;

        tmp = themeColors["--tab-active-text"];
        themeColors["--tab-active-text"] = themeColors["--tab-text"];
        themeColors["--tab-text"] = tmp;
      }
    }

    // Since Firefox Color uses additional_backgrounds instead of theme_frame,
    // TCRn won’t fall back to default theme even if colors aren’t readable,
    // so the user won’t think that TCRn is buggy with regards to Firefox Color
    if (theme.images && theme.images.theme_frame && !isThemeReadable(themeColors)) {
      for (const cssVar of Object.keys(cssToThemeProp)) {
        themeColors[cssVar] = null;
      }
    }

    // apply color if one was found, otherwise remove var and use default style
    for (const [cssVar, color] of Object.entries(themeColors)) {
      if (color !== null) {
        style.setProperty(cssVar, color);
      } else {
        style.removeProperty(cssVar);
      }
    }

    document.body.classList.toggle(
      "has-custom-input-color",
      themeColors["--input-selected-text"] !== null &&
        themeColors["--input-selected-text-background"] !== null,
    );
  }
}

function isThemeReadable(themeColors) {
  // if a value is not defined, we use its default value to check if it is actually readable
  return (
    isReadable(themeColors["--background"] || "#ffffff", themeColors["--tab-text"] || "#0c0c0d") &&
    isReadable(
      themeColors["--tab-active-background"] || "#d7d7db",
      themeColors["--tab-active-text"] || "#0c0c0d",
    ) &&
    isReadable(
      themeColors["--toolbar-background"] || "#f9f9fa",
      themeColors["--icons"] || "rgba(249, 249, 250, 0.8)",
    )
  );
}

// Some theme have bad contrast, but we only want to avoid incorrect themes
// So we don’t check constrast >= AA but some arbitrary value to avoid white on white…
function isReadable(color1, color2) {
  return readability(color1, color2) >= 2;
}

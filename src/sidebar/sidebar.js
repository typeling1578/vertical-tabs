/* global browser */

import Sidetab from "./sidetab.js";
import Tablist from "./tablist.js";
import Topmenu from "./topmenu.js";
import { extractNew } from "./utils.js";

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
    this.windowId = window.id;
    this.incognito = window.incognito;

    const platform = await browser.runtime.getPlatformInfo();
    document.body.setAttribute("platform", platform.os);

    this._topMenu = new Topmenu(this);

    await this._initPrefs();
    this._tablist = new Tablist(this);
    this._onStorageChanged(this.prefs);

    browser.runtime.connect({ name: this.windowId.toString() });
    this._setupListeners();
  }

  filter(val) {
    this._tablist.filter(val);
    this._topMenu.updateSearch(val);
  }

  createTab(props, options) {
    this._tablist.createTab(props, options);
  }

  async _initPrefs(prefs) {
    this.prefs = await this._getPrefs();
    this._theme = await browser.theme.getCurrent(this.windowId);
  }

  _setupListeners() {
    browser.storage.onChanged.addListener((changes) => {
      this._onStorageChanged(extractNew(changes));
    });

    if (browser.theme.onUpdated) {
      browser.theme.onUpdated.addListener(({ theme, windowId }) =>
        this._onThemeUpdated(theme, windowId),
      );
    }

    this._updateContextualIdentities();
    browser.contextualIdentities.onCreated.addListener(this._updateContextualIdentities);
    browser.contextualIdentities.onRemoved.addListener(this._updateContextualIdentities);
    browser.contextualIdentities.onUpdated.addListener(this._updateContextualIdentities);

    window.addEventListener("contextmenu", (e) => this._onContextMenu(e), false);
  }

  _onContextMenu(e) {
    const target = e.target;
    // Let the filterbox input and the tabs have a context menu.
    if (
      !(target && (target.id === "filterbox-input" || target.id.startsWith("newtab"))) &&
      !Sidetab.isTabEvent(e, false)
    ) {
      e.preventDefault();
    }
  }

  _onThemeUpdated(theme, windowId) {
    if (!windowId || windowId === this.windowId) {
      this._theme = theme;
      this._applyTheme(theme);
    }
  }

  _applyCustomCSS() {
    document.getElementById("customCSS").textContent = this.prefs.useCustomCSS
      ? this.prefs.customCSS
      : "";
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

    const prefs = await browser.storage.sync.get({
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

    if (typeof prefs.compactMode === "string") {
      prefs.compactMode = parseInt(prefs.compactMode);
    }

    return prefs;
  }

  _onStorageChanged(changes) {
    // merge prefs
    if (changes.hasOwnProperty("compactMode")) {
      changes.compactMode = parseInt(changes.compactMode);
    }
    if (changes.hasOwnProperty("switchByScrolling")) {
      changes.switchByScrolling = parseInt(changes.switchByScrolling);
    }
    Object.assign(this.prefs, changes);

    // apply changes
    if (changes.hasOwnProperty("customCSS") || changes.hasOwnProperty("useCustomCSS")) {
      this._applyCustomCSS();
    }
    if (changes.hasOwnProperty("themeIntegration")) {
      this._applyTheme(this._theme);
    }
    if (changes.hasOwnProperty("animations")) {
      document.body.classList.toggle("animated", this._animations);
    }

    if (changes.hasOwnProperty("compactPins")) {
      this._tablist.setCompactPins();
    }
    if (
      changes.hasOwnProperty("compactMode") ||
      changes.hasOwnProperty("compactPins") ||
      changes.hasOwnProperty("customCSS") ||
      changes.hasOwnProperty("useCustomCSS")
    ) {
      this._tablist._maybeShrinkTabs();
    }
  }

  _applyTheme(theme) {
    const style = document.body.style;

    // if theme integration is disabled or theme is not usable, remove css variables then return
    if (!this.prefs.themeIntegration) {
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
      for (const cssVar of Object.keys(CSS_TO_THEME_PROPS)) {
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

  getContextualIdentityItems(cookieStoreId = "firefox-default") {
    const tabInContainer = cookieStoreId !== "firefox-default";
    const items = [
      {
        id: "firefox-default",
        title: browser.i18n.getMessage("contextMenuNoContainer"),
        visible: tabInContainer,
      },
      {
        type: "separator",
        visible: tabInContainer,
      },
    ];
    for (const identity of this.contextualIdentities) {
      items.push({
        id: identity.cookieStoreId,
        title: identity.name,
        icons: { "16": `/sidebar/img/identities/${identity.icon}.svg#${identity.color}` },
        visible: cookieStoreId !== identity.cookieStoreId,
      });
    }
    return items;
  }

  _updateContextualIdentities() {
    browser.contextualIdentities.query({}).then(
      (identities) => {
        this.contextualIdentities = identities;
      },
      () => {
        this.contextualIdentities = [];
      },
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

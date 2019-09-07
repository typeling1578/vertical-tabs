/* global browser */

import SideTab from "./tab.js";
import TabList from "./tablist.js";
import TopMenu from "./topmenu.js";
import { throttled } from "./utils.js";

export default class TabCenter {
  async init() {
    const window = await browser.windows.getCurrent();
    document.body.classList.toggle("incognito", window.incognito);
    this._windowId = window.id;

    const platform = await browser.runtime.getPlatformInfo();
    document.body.setAttribute("platform", platform.os);

    const search = this._search.bind(this);
    this._topMenu = new TopMenu({ search });

    const prefs = await this._getPrefs();
    if (typeof prefs.compactMode === "string") {
      prefs.compactMode = parseInt(prefs.compactMode);
    }
    this._initPrefs(prefs);

    this._tablist = new TabList({
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
    this._onWheel = throttled(e => this.__onWheel(e), 50);
    window.addEventListener("wheel", e => this._onWheel(e));
  }

  _onContextMenu(e) {
    const target = e.target;
    // Let the searchbox input and the tabs have a context menu.
    if (
      !(target && (target.id === "searchbox-input" || target.id.startsWith("newtab"))) &&
      !SideTab.isTabEvent(e, false)
    ) {
      e.preventDefault();
    }
  }

  __onWheel(e) {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
    }
    if (e.ctrlKey) {
      const scrollDirection = e.deltaY < 0 ? -1 : 1;
      this._tablist._activateTabFromCurrent(scrollDirection);
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

    // fallbacks for theme colors
    const cssToThemeProp = {
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

    // if theme integration is disabled or theme is not usable, remove css variables then return
    if (!this._themeIntegrationEnabled || (theme.images && !theme.colors["sidebar"])) {
      for (const cssVar of Object.keys(cssToThemeProp)) {
        style.removeProperty(cssVar);
      }
      return;
    }

    // get the effective values we will be using
    const themeColors = {};
    for (const [cssVar, themeProps] of Object.entries(cssToThemeProp)) {
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
    if (themeColors["--background"] !== null && isLight(themeColors["--background"])) {
      if (themeColors["--tab-active-background"] !== null) {
        let tmp = themeColors["--background"];
        themeColors["--background"] = themeColors["--tab-active-background"];
        themeColors["--tab-active-background"] = tmp;

        tmp = themeColors["--tab-active-text"];
        themeColors["--tab-active-text"] = themeColors["--tab-text"];
        themeColors["--tab-text"] = tmp;
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

// from https://awik.io/determine-color-bright-dark-using-javascript/
function isLight(color) {
  let r, g, b;
  if (color.match(/^rgb/)) {
    // If HEX, store the red, green, blue values in separate variables
    [r, g, b] = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/).slice(1);
  } else {
    // If RGB, convert it to HEX: http://gist.github.com/983661
    color = `0x${color.slice(1).replace(color.length < 5 && /./g, "$&$&")}`;
    r = color >> 16;
    g = (color >> 8) & 255;
    b = color & 255;
  }

  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp > 127.5;
}

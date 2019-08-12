/* global browser */

import SideTab from "./tab.js";
import TabList from "./tablist.js";
import TopMenu from "./topmenu.js";
import { throttled } from "./utils.js";

export default class TabCenter {
  async init() {
    this._prefsLocalToSync();

    const window = await browser.windows.getCurrent();
    document.body.classList.toggle("incognito", window.incognito);
    this._windowId = window.id;

    browser.runtime.getPlatformInfo().then(platform => {
      document.body.setAttribute("platform", platform.os);
    });

    const search = this._search.bind(this);
    this._topMenu = new TopMenu({ search });

    this._setupListeners();

    const prefs = await this._readPrefs();
    this._applyPrefs(prefs);
    this._tabList = new TabList({
      windowId: this._windowId,
      search,
      prefs,
    });

    browser.runtime.connect({ name: this._windowId.toString() });
  }

  // migrate user settings from local storage to sync storage
  async _prefsLocalToSync() {
    const prefDefaults = {
      themeIntegration: true,
      compactModeMode: 1,
      compactPins: true,
      switchLastActiveTab: true,
      notifyClosingManyTabs: true,
      useCustomCSS: true,
      customCSS: "",
    };
    const localPrefs = await browser.storage.local.get(prefDefaults);

    // rename (typo) setting `compactModeMode` to `compactMode`
    localPrefs["compactMode"] = localPrefs["compactModeMode"];
    delete localPrefs["compactModeMode"];

    // merge with sync prefs and clear local storage
    const prefs = await browser.storage.sync.get(localPrefs);
    browser.storage.sync.set(prefs);
    browser.storage.local.clear();
  }

  _search(val) {
    this._tabList.filter(val);
    this._topMenu.updateSearch(val);
  }

  _setupListeners() {
    window.addEventListener(
      "contextmenu",
      e => {
        const target = e.target;
        // Let the searchbox input and the tabs have a context menu.
        if (
          !(target && (target.id === "searchbox-input" || target.id.startsWith("newtab"))) &&
          !SideTab.isTabEvent(e, false)
        ) {
          e.preventDefault();
        }
      },
      false,
    );
    browser.storage.onChanged.addListener(changes => this._applyPrefs(changes));
    this._themeListener = ({ theme, windowId }) => {
      if (!windowId || windowId === this._windowId) {
        this._applyTheme(theme);
      }
    };
    const handleWheel = e => {
      if (e.ctrlKey) {
        const scrollDirection = e.deltaY < 0 ? -1 : 1;
        this._tabList._activateTabFromCurrent(scrollDirection);
      }
    };
    window.addEventListener("wheel", throttled(50, handleWheel));
  }

  _applyCustomCSS() {
    document.getElementById("customCSS").textContent = this._useCustomCSS ? this._customCSS : "";
  }

  set _themeIntegration(enabled) {
    if (!browser.theme.onUpdated) {
      return;
    }
    if (!enabled) {
      this._applyTheme({});
      if (browser.theme.onUpdated.hasListener(this._themeListener)) {
        browser.theme.onUpdated.removeListener(this._themeListener);
      }
    } else {
      browser.theme.onUpdated.addListener(this._themeListener);
      browser.theme.getCurrent(this._windowId).then(this._applyTheme.bind(this));
    }
  }

  _readPrefs() {
    return browser.storage.sync.get({
      themeIntegration: true,
      compactMode: 1 /* COMPACT_MODE_DYNAMIC */,
      compactPins: true,
      switchLastActiveTab: true,
      warnBeforeClosing: true,
      useCustomCSS: true,
      customCSS: "",
    });
  }

  _applyPrefs(prefs) {
    if (prefs.hasOwnProperty("useCustomCSS")) {
      this._useCustomCSS = prefs.useCustomCSS;
      this._applyCustomCSS();
    }
    if (prefs.hasOwnProperty("customCSS")) {
      this._customCSS = prefs.customCSS;
      this._applyCustomCSS();
    }
    if (prefs.hasOwnProperty("themeIntegration")) {
      this._themeIntegration = prefs.themeIntegration;
    }
  }

  _applyTheme(theme) {
    const style = document.body.style;
    const cssToThemeProp = {
      "--background": ["frame", "accentcolor"],
      "--button-background-active": ["button_background_active"],
      "--button-background-hover": ["button_background_hover"],
      "--icons": ["icons", "toolbar_text", "textcolor"],
      "--tab-separator": [
        "tab_background_separator",
        "toolbar_field_separator",
        "toolbar_top_separator",
      ],
      "--tab-selected-line": ["tab_line"],
      "--tab-loading-indicator": ["tab_loading"],
      "--tab-active-background": ["tab_selected", "toolbar"],
      "--tab-active-text": ["tab_text", "toolbar_text", "tab_background_text", "textcolor"],
      "--tab-text": ["tab_background_text", "textcolor", "tab_text", "toolbar_text"],
      "--toolbar-background": ["toolbar", "frame", "accentcolor"],
      "--toolbar-text": ["toolbar_text", "textcolor"],
      "--input-background": ["toolbar_field"],
      "--input-border": ["toolbar_field_border"],
      "--input-border-focus": ["toolbar_field_border_focus"],
      "--input-background-focus": ["toolbar_field_focus"],
      "--input-selected-text-background": ["toolbar_field_highlight", "button_background_active"],
      "--input-selected-text": ["toolbar_field_highlight_text", "toolbar_field_text"],
      "--input-text": ["bookmark_text", "toolbar_field_text"],
      "--input-text-focus": ["toolbar_field_text_focus", "toolbar_field_text"],
      "--sidebar-background": ["sidebar", "frame", "accentcolor"],
      "--sidebar-text": ["sidebar_text", "tab_text", "toolbar_text", "textcolor"],
      "sidebar-text": ["sidebar_text"],
    };

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

    setBrowserActionColor(
      themeColors["--icons"] || "#5a5b5c",
      themeColors["sidebar-text"] || "#5a5b5c",
    );
    delete themeColors["sidebar-text"];

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

  startTests() {
    const script = document.createElement("script");
    script.src = "../test/index.js";
    document.head.appendChild(script);
  }
}

function setBrowserActionColor(browserColor, sidebarColor) {
  // src/tabcenter.svg but a little reduced
  const svgStr =
    "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' height='128' width='128' viewBox='0 0 16 16'%3E%3Cdefs%3E%3Csymbol id='shape'%3E%3Cpath d='M3,1h10a3,3,0,0,1,3,3v8a3,3,0,0,1,-3,3h-10a3,3,0,0,1,-3,-3v-8a3,3,0,0,1,3,-3Z M3,3h 4a1,1,0,0,1,1,1v8a1,1,0,0,1,-1,1h -4a1,1,0,0,1,-1,-1v-8a1,1,0,0,1,1,-1Z' fill-rule='evenodd' /%3E%3Ccircle cx='3.5' cy='4.5' r='.6' /%3E%3Ccircle cx='3.5' cy='6.5' r='.6' /%3E%3Ccircle cx='3.5' cy='8.5' r='.6' /%3E%3Crect x='4.75' y='4' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='6' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='8' height='1' width='2.25' rx='.5' ry='.5' /%3E%3C/symbol%3E%3C/defs%3E%3Cuse class='theme' id='default' fill='$fillcolor' href='%23shape' /%3E%3C/svg%3E%0A";

  const browserSvgStr = svgStr.replace("$fillcolor", browserColor.replace("#", "%23"));
  browser.browserAction.setIcon({
    path: {
      16: browserSvgStr,
      32: browserSvgStr,
    },
  });

  const sidebarSvgStr = svgStr.replace("$fillcolor", sidebarColor.replace("#", "%23"));
  browser.sidebarAction.setIcon({
    path: {
      16: sidebarSvgStr,
      32: sidebarSvgStr,
    },
  });
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

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

    browser.runtime.getPlatformInfo().then(platform => {
      document.body.setAttribute("platform", platform.os);
    });

    const search = this._search.bind(this);
    this._topMenu = new TopMenu({ search });

    this._currentTheme = {};
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
    browser.storage.onChanged.addListener(changes => this._applyPrefs(unwrapChanges(changes)));
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

  set _darkTheme(isDarkTheme) {
    this._isDarkTheme = isDarkTheme;
    this._useDarkTheme(isDarkTheme);
    this._applyTheme(this._currentTheme);
  }

  _useDarkTheme(isDarkTheme) {
    if (isDarkTheme || this._isDarkTheme) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }

    const type = isDarkTheme ? "light" : "dark";
    browser.sidebarAction.setIcon({
      path: {
        16: `../tabcenter.svg#${type}`,
        32: `../tabcenter.svg#${type}`,
      },
    });
  }

  set _themeIntegration(enabled) {
    if (!browser.theme.onUpdated) {
      return;
    }
    if (!enabled) {
      this._resetTheme();
      if (browser.theme.onUpdated.hasListener(this._themeListener)) {
        browser.theme.onUpdated.removeListener(this._themeListener);
      }
    } else {
      browser.theme.onUpdated.addListener(this._themeListener);
      browser.theme.getCurrent(this._windowId).then(this._applyTheme.bind(this));
    }
  }

  _readPrefs() {
    return browser.storage.local.get({
      darkTheme: false,
      themeIntegration: false,
      compactModeMode: 1 /* COMPACT_MODE_DYNAMIC */,
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
    if (prefs.hasOwnProperty("darkTheme")) {
      this._darkTheme = prefs.darkTheme;
    }
    if (prefs.hasOwnProperty("themeIntegration")) {
      this._themeIntegration = prefs.themeIntegration;
    }
  }

  _applyTheme(theme) {
    this._currentTheme = theme;
    const cssToThemeProp = {
      "--background": ["frame", "accentcolor"],
      "--button-background-active": ["button_background_active"],
      "--button-background-hover": ["button_background_hover"],
      "--icons": ["icons", "textcolor"],
      "--tab-separator": ["tab_background_separator", "toolbar_top_separator"],
      "--tab-selected-line": ["tab_line"],
      "--tab-loading-indicator": ["tab_loading"],
      "--tab-active-background": ["tab_selected", "toolbar"],
      "--tab-text": ["tab_text", "toolbar_text", "tab_background_text", "textcolor"],
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
    };

    let hasInputSelectedTextBackground = false;
    let hasInputSelectedText = false;
    for (const [cssVar, themeProps] of Object.entries(cssToThemeProp)) {
      for (const prop of themeProps) {
        if (theme.colors && theme.colors[prop]) {
          if (cssVar === "--sidebar-text") {
            setBrowserActionColor(theme.colors[prop]);
          }
          document.body.style.setProperty(cssVar, theme.colors[prop]);
          if (cssVar === "--input-selected-text-background") {
            hasInputSelectedTextBackground = true;
          } else if (cssVar === "--input-selected-text") {
            hasInputSelectedText = true;
          }
          break;
        }
        document.body.style.removeProperty(cssVar);
      }
    }

    if (hasInputSelectedTextBackground && hasInputSelectedText) {
      document.body.classList.add("has-custom-input-color");
    } else {
      document.body.classList.remove("has-custom-input-color");
    }
  }

  _resetTheme() {
    this._useDarkTheme(this._isDarkTheme);
    this._applyTheme({});
  }

  startTests() {
    const script = document.createElement("script");
    script.src = "../test/index.js";
    document.head.appendChild(script);
  }
}

function unwrapChanges(changes) {
  const unwrapped = {};
  for (const [pref, change] of Object.entries(changes)) {
    unwrapped[pref] = change.newValue;
  }
  return unwrapped;
}

function setBrowserActionColor(color) {
  // src/tabcenter.svg but a little reduced
  const svgStr = `data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' height='128' width='128' viewBox='0 0 16 16'%3E%3Cdefs%3E%3Csymbol id='shape'%3E%3Cpath d='M3,1h10a3,3,0,0,1,3,3v8a3,3,0,0,1,-3,3h-10a3,3,0,0,1,-3,-3v-8a3,3,0,0,1,3,-3Z M3,3h 4a1,1,0,0,1,1,1v8a1,1,0,0,1,-1,1h -4a1,1,0,0,1,-1,-1v-8a1,1,0,0,1,1,-1Z' fill-rule='evenodd' /%3E%3Ccircle cx='3.5' cy='4.5' r='.6' /%3E%3Ccircle cx='3.5' cy='6.5' r='.6' /%3E%3Ccircle cx='3.5' cy='8.5' r='.6' /%3E%3Crect x='4.75' y='4' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='6' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='8' height='1' width='2.25' rx='.5' ry='.5' /%3E%3C/symbol%3E%3C/defs%3E%3Cuse class='theme' id='default' fill='${color.replace(
    "#",
    "%23",
  )}' href='%23shape' /%3E%3C/svg%3E%0A`;
  browser.sidebarAction.setIcon({
    path: {
      16: svgStr,
      32: svgStr,
    },
  });
}

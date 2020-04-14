"use strict";
/* global browser */

import { svgToDataUrl } from "../common.js";

class Background {
  constructor() {
    this.updateTheme();
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener((port) => this.onConnect(port));
    browser.browserAction.onClicked.addListener((tab) => this.onClick(tab));
    browser.commands.onCommand.addListener((command) => this.onCommand(command));
    this.reloadOptionPage();
  }

  async updateTheme() {
    if (!browser.theme.onUpdated) {
      return;
    }
    const theme = await browser.theme.getCurrent();
    this.onThemeUpdated(theme);
    browser.theme.onUpdated.addListener(({ theme }) => this.onThemeUpdated(theme));
  }

  onThemeUpdated(theme) {
    const browserColorFallback = [
      "icons",
      "toolbar_text",
      "bookmark_text",
      "tab_background_text",
      "tab_text",
    ];

    // get the effective values we will be using
    let browserColor = "#5a5b5c";
    for (const prop of browserColorFallback) {
      if (!theme.colors) {
        break;
      }
      if (theme.colors[prop]) {
        browserColor = theme.colors[prop];
        break;
      }
    }

    const sidebarTextColor =
      theme.colors && theme.colors["sidebar_text"] ? theme.colors["sidebar_text"] : "#5a5b5c";

    setButtonsActionColor(browserColor, sidebarTextColor);
  }

  onConnect(port) {
    const windowId = parseInt(port.name);
    this.openedSidebarWindows[windowId] = port;
    port.onDisconnect.addListener((port) => {
      delete this.openedSidebarWindows[parseInt(port.name)];
    });
  }

  onClick({ windowId }) {
    if (this.openedSidebarWindows[windowId] !== undefined) {
      browser.sidebarAction.close();
    } else {
      browser.sidebarAction.open();
    }
  }

  onCommand(command) {
    switch (command) {
      case "switch-to-last-active-tab":
        browser.tabs.query({ currentWindow: true }).then((tabs) => {
          tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
          browser.tabs.update(tabs[1].id, { active: true });
        });
    }
  }

  // Reload option page so that it’s never out-of-sync when hot-reloading during dev
  reloadOptionPage() {
    browser.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (tab.url === "about:addons") {
          browser.tabs.reload(tab.id);
        }
      }
    });
  }
}

new Background();

// src/tabcenter.svg but a bit reduced and adapted
const TABCENTER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" height="128" width="128" viewBox="0 0 16 16"><style>g{fill:context-fill}</style><g><path d="M3,1h10a3,3,0,0,1,3,3v8a3,3,0,0,1,-3,3h-10a3,3,0,0,1,-3,-3v-8a3,3,0,0,1,3,-3Z M3,3h 4a1,1,0,0,1,1,1v8a1,1,0,0,1,-1,1h -4a1,1,0,0,1,-1,-1v-8a1,1,0,0,1,1,-1Z" fill-rule="evenodd" /><circle cx="3.5" cy="4.5" r=".6" /><circle cx="3.5" cy="6.5" r=".6" /><circle cx="3.5" cy="8.5" r=".6" /><rect x="4.75" y="4" height="1" width="2.25" rx=".5" ry=".5" /><rect x="4.75" y="6" height="1" width="2.25" rx=".5" ry=".5" /><rect x="4.75" y="8" height="1" width="2.25" rx=".5" ry=".5" /></g></svg>';

// Toolbar icon takes a different color than the sidebar header icon
function setButtonsActionColor(browserColor, sidebarColor) {
  browser.browserAction.setIcon({ path: svgToDataUrl(TABCENTER_ICON, browserColor) });
  browser.sidebarAction.setIcon({ path: svgToDataUrl(TABCENTER_ICON, sidebarColor) });
}

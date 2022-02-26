"use strict";
/* global browser */

import { svgToDataUrl } from "../common.js";

// src/vertical-tabs.svg but a bit reduced and adapted
const VERTICAL_TABS_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="context-fill" viewBox="0 0 16 16">
  <path d="M2.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm2-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm1 .5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
  <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v2H1V3a1 1 0 0 1 1-1h12zM1 13V6h4v8H2a1 1 0 0 1-1-1zm5 1V6h9v7a1 1 0 0 1-1 1H6z"/>
</svg>
`;

class Background {
  constructor() {
    this.updateTheme();
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener((port) => this.onConnect(port));
    browser.browserAction.onClicked.addListener((tab) => this.onClick(tab));
    browser.commands.onCommand.addListener((command) => this.onCommand(command));
    // Reload option page so that it’s never out-of-sync when hot-reloading during dev
    this.reloadOptionPage();
  }

  async updateTheme() {
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

    browser.browserAction.setIcon({ path: svgToDataUrl(VERTICAL_TABS_ICON, browserColor) });
    browser.sidebarAction.setIcon({ path: svgToDataUrl(VERTICAL_TABS_ICON, sidebarTextColor) });
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

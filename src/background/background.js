/* global browser */

class TabCenterBackground {
  constructor() {
    this.updateTheme();
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener(tab => this.onClick(tab));
    browser.commands.onCommand.addListener(command => this.onCommand(command));
    this.reloadOptionPage();
  }

  async updateTheme() {
    if (!browser.theme.onUpdated) {
      return;
    }
    const windows = await browser.windows.getAll();
    for (const window of windows) {
      browser.theme.getCurrent(window.id).then(theme => {
        this.onThemeUpdated(theme, window.id);
      });
    }
    browser.theme.onUpdated.addListener(({ theme, windowId }) =>
      this.onThemeUpdated(theme, windowId),
    );
  }

  onThemeUpdated(theme, windowId) {
    const iconsColorFallback = [
      "icons",
      "toolbar_text",
      "bookmark_text",
      "tab_background_text",
      "tab_text",
    ];

    // get the effective values we will be using
    let iconsColor = "#5a5b5c";
    for (const prop of iconsColorFallback) {
      if (!theme.colors) {
        break;
      }
      if (theme.colors[prop]) {
        iconsColor = theme.colors[prop];
        break;
      }
    }

    const sidebarTextColor =
      theme.colors && theme.colors["sidebar_text"] ? theme.colors["sidebar_text"] : "#5a5b5c";

    setButtonsActionColor(iconsColor, sidebarTextColor, windowId);
  }

  onConnect(port) {
    const windowId = parseInt(port.name);
    this.openedSidebarWindows[windowId] = port;
    port.onDisconnect.addListener(port => {
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
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
          browser.tabs.update(tabs[1].id, { active: true });
        });
    }
  }

  // Reload option page so that it’s never out-of-sync when hot-reloading during dev
  reloadOptionPage() {
    browser.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        if (tab.url === "about:addons") {
          browser.tabs.reload(tab.id);
        }
      }
    });
  }
}

new TabCenterBackground();

// Toolbar icon takes a different color than the sidebar header icon
function setButtonsActionColor(browserColor, sidebarColor, windowId) {
  // src/tabcenter.svg but a little reduced
  const svgStr =
    "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' height='128' width='128' viewBox='0 0 16 16'%3E%3Cdefs%3E%3Csymbol id='shape'%3E%3Cpath d='M3,1h10a3,3,0,0,1,3,3v8a3,3,0,0,1,-3,3h-10a3,3,0,0,1,-3,-3v-8a3,3,0,0,1,3,-3Z M3,3h 4a1,1,0,0,1,1,1v8a1,1,0,0,1,-1,1h -4a1,1,0,0,1,-1,-1v-8a1,1,0,0,1,1,-1Z' fill-rule='evenodd' /%3E%3Ccircle cx='3.5' cy='4.5' r='.6' /%3E%3Ccircle cx='3.5' cy='6.5' r='.6' /%3E%3Ccircle cx='3.5' cy='8.5' r='.6' /%3E%3Crect x='4.75' y='4' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='6' height='1' width='2.25' rx='.5' ry='.5' /%3E%3Crect x='4.75' y='8' height='1' width='2.25' rx='.5' ry='.5' /%3E%3C/symbol%3E%3C/defs%3E%3Cuse class='theme' id='default' fill='$fillcolor' href='%23shape' /%3E%3C/svg%3E%0A";

  const browserSvgStr = svgStr.replace("$fillcolor", browserColor.replace("#", "%23"));
  browser.browserAction.setIcon({
    path: {
      16: browserSvgStr,
      32: browserSvgStr,
    },
    windowId,
  });

  const sidebarSvgStr = svgStr.replace("$fillcolor", sidebarColor.replace("#", "%23"));
  browser.sidebarAction.setIcon({
    path: {
      16: sidebarSvgStr,
      32: sidebarSvgStr,
    },
    windowId,
  });
}

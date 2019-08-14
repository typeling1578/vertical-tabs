/* global browser */

class TabCenterBackground {
  constructor() {
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener(tab => this.onClick(tab));
    browser.commands.onCommand.addListener(command => this.onCommand(command));
    this.reloadOptionPage();
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

/* global browser */

const BADGE_DISABLED_BACKGROUND = "#38383d";
const BADGE_ENABLED_BACKGROUND = "#058b00";

class TabCenterBackground {
  constructor() {
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener(tab => this.onClick(tab));

    browser.browserAction.setBadgeText({ text: "⏻" });
    browser.browserAction.setBadgeTextColor({ color: "white" });
    browser.browserAction.setBadgeBackgroundColor({
      color: BADGE_DISABLED_BACKGROUND,
    });
  }

  onConnect(port) {
    const windowId = parseInt(port.name);
    this.openedSidebarWindows[windowId] = port;
    browser.browserAction.setBadgeBackgroundColor({
      color: BADGE_ENABLED_BACKGROUND,
      windowId,
    });
    port.onDisconnect.addListener(port => {
      delete this.openedSidebarWindows[parseInt(port.name)];
      browser.windows.getAll().then(windows => {
        // Don’t try to set badge background color to closed window
        if (windows.map(window => window.id).some(id => id === windowId)) {
          browser.browserAction.setBadgeBackgroundColor({
            color: BADGE_DISABLED_BACKGROUND,
            windowId,
          });
        }
      });
    });
  }

  onClick({ windowId }) {
    if (this.openedSidebarWindows[windowId] !== undefined) {
      browser.sidebarAction.close();
    } else {
      browser.sidebarAction.open();
    }
  }
}

new TabCenterBackground();

/* global browser */

const BADGE_DISABLED_BACKGROUND = "#38383d";
const BADGE_ENABLED_BACKGROUND = "#058b00";

class TabCenterBackground {
  constructor() {
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener(tab => this.onClick(tab));
    browser.browserAction.setBadgeTextColor({ color: "white" });
    this.toggleButtonState(false);
  }

  onConnect(port) {
    const windowId = parseInt(port.name);
    this.openedSidebarWindows[windowId] = port;
    this.toggleButtonState(true, windowId);
    port.onDisconnect.addListener(port => {
      delete this.openedSidebarWindows[parseInt(port.name)];
      browser.windows.getAll().then(windows => {
        // Don’t try to set badge background color to closed window
        if (windows.map(window => window.id).some(id => id === windowId)) {
          this.toggleButtonState(false, windowId);
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

  // if windowId is undefined, state is applied browser-wide
  toggleButtonState(state, windowId) {
    const text = state
      ? browser.i18n.getMessage("browserActionOn")
      : browser.i18n.getMessage("browserActionOff");
    const color = state ? BADGE_ENABLED_BACKGROUND : BADGE_DISABLED_BACKGROUND;
    browser.browserAction.setBadgeText({ text, windowId });
    browser.browserAction.setBadgeBackgroundColor({ color, windowId });
  }
}

new TabCenterBackground();

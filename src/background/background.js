/* global browser */

class TabCenterBackground {
  constructor() {
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener(tab => this.onClick(tab));
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
}

new TabCenterBackground();

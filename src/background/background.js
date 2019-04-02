class TabCenterBackground {
  constructor() {
    this.openedSidebarWindows = {};
    browser.runtime.onConnect.addListener(port => this.onConnect(port));
    browser.browserAction.onClicked.addListener((tab) => this.onClick(tab));
    browser.browserAction.setBadgeTextColor({color: "white"});
  }

  onConnect(port) {
    const windowId = parseInt(port.name);
    this.openedSidebarWindows[windowId] = port;
    browser.browserAction.setBadgeText({text: "⏻", windowId});
    browser.browserAction.setBadgeBackgroundColor({color: "#058b00"});
    port.onDisconnect.addListener(port => {
      delete this.openedSidebarWindows[parseInt(port.name)];
      browser.browserAction.setBadgeBackgroundColor({color: "#38383d"});
    });
  }

  onClick({windowId}) {
    if (this.openedSidebarWindows[windowId] !== undefined) {
      browser.sidebarAction.close();
    } else {
      browser.sidebarAction.open();
    }
  }
}

new TabCenterBackground();

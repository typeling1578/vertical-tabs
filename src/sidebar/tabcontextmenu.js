import SideTab from "./tab.js";

const IS_PRIVILEGED_PAGE_URL = /^(about|chrome|data|file|javascript):*/;

export default class TabContextMenu {
  constructor(tablist) {
    this._tablist = tablist;

    browser.menus.onClicked.addListener((info, tab) => {
      switch (info.menuItemId) {
      case "contextMenuReloadTab":
        browser.tabs.reload(tab.id);
        break;
      case "contextMenuMuteTab":
        browser.tabs.update(tab.id, {"muted": !tab.mutedInfo.muted});
        break;
      case "contextMenuPinTab":
        browser.tabs.update(tab.id, {"pinned": !tab.pinned});
        break;
      case "contextMenuDuplicateTab":
        browser.tabs.duplicate(tab.id);
        break;
      case "contextMenuAddTabToBookmarks":
        browser.bookmarks.create({
          title: tab.title,
          url: tab.url
        });
        break;
      case "contextMenuMoveTabToStart":
        this._tablist.moveTabToStart(tab);
        break;
      case "contextMenuMoveTabToEnd":
        this._tablist.moveTabToEnd(tab);
        break;
      case "contextMenuMoveTabToNewWindow":
        browser.windows.create({tabId: tab.id});
        break;
      case "contextMenuCloseTabsUnderneath":
        this._tablist.closeTabsAfter(tab.index);
        break;
      case "contextMenuCloseOtherTabs":
        this._tablist.closeAllTabsExcept(tab.id);
        break;
      case "contextMenuUndoCloseTab":
        this._tablist.undoCloseTab();
        break;
      case "contextMenuCloseTab":
        browser.tabs.remove(tab.id);
        break;
      }

      if (info.menuItemId.startsWith("contextMenuOpenInContextualTab_")) {
        let newTab = {cookieStoreId: info.menuItemId.split("contextMenuOpenInContextualTab_")[1]};
        if (tab.url !== "about:newtab") {
          newTab["url"] = tab.url;
        }
        browser.tabs.create(newTab);
      }
    });
  }

  open(e) {
    if (!SideTab.isTabEvent(e, false)) {
      e.preventDefault();
      return;
    }
    browser.menus.removeAll();

    const tabId = SideTab.tabIdForEvent(e);
    const tab = this._tablist.getTabById(tabId);

    const items = [{
      id: "contextMenuReloadTab",
      title: browser.i18n.getMessage("contextMenuReloadTab")
    }, {
      id: "contextMenuMuteTab",
      title: browser.i18n.getMessage(tab.muted ? "contextMenuUnmuteTab" :
                                                 "contextMenuMuteTab")
    }, {
      type: "separator"
    }, {
      id: "contextMenuPinTab",
      title: browser.i18n.getMessage(tab.pinned ? "contextMenuUnpinTab" :
                                                  "contextMenuPinTab")
    }, {
      id: "contextMenuDuplicateTab",
      title: browser.i18n.getMessage("contextMenuDuplicateTab")
    }, {
      type: "separator"
    }, /*
        * We don’t have “Add to bookmarks” because it requires us to code the dialog.
        * Also, it’s not very useful since you can bookmark the active tab easily anyway.
        */
    {
      id: "contextMenuOpenInContextualTab",
      title: browser.i18n.getMessage("contextMenuOpenInContextualTab"),
      enabled: !IS_PRIVILEGED_PAGE_URL.test(tab.url)
        || tab.url === "about:newtab"
        || tab.url === "about:blank",
      visible: browser.contextualIdentities !== undefined
    }, {
      id: "contextMenuMoveTab",
      title: browser.i18n.getMessage("contextMenuMoveTab"),
      enabled: this._tablist.tabCount() > 1
    }, {
      parentId: "contextMenuMoveTab",
      id: "contextMenuMoveTabToStart",
      title: browser.i18n.getMessage("contextMenuMoveTabToStart"),
      enabled: tab.index !== 0
    }, {
      parentId: "contextMenuMoveTab",
      id: "contextMenuMoveTabToEnd",
      title: browser.i18n.getMessage("contextMenuMoveTabToEnd"),
      enabled: tab.index !== this._tablist.tabCount() - 1
    }, {
      parentId: "contextMenuMoveTab",
      id: "contextMenuMoveTabToNewWindow",
      title: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
      enabled: this._tablist.tabCount() !== 1
    }, {
      type: "separator"
    }, {
      id: "contextMenuCloseTabsUnderneath",
      title: browser.i18n.getMessage("contextMenuCloseTabsUnderneath"),
      enabled: this._tablist.hasTabsUnderneath(tab),
      visible: !this._tablist.isFilterActive()
    }, {
      id: "contextMenuCloseOtherTabs",
      title: browser.i18n.getMessage("contextMenuCloseOtherTabs"),
      enabled: this._tablist.tabCount() !== 1
    }, {
      type: "separator"
    }, {
      id: "contextMenuUndoCloseTab",
      title: browser.i18n.getMessage("contextMenuUndoCloseTab"),
      enabled: this._tablist.hasRecentlyClosedTabs
    }, {
      id: "contextMenuCloseTab",
      title: browser.i18n.getMessage("contextMenuCloseTab")
    }];

    items.forEach(item => {
      browser.menus.create({
        ...item,
        contexts: ["tab"],
        viewTypes: ["sidebar"],
        documentUrlPatterns: [`moz-extension://${location.host}/*`]
      });
    });

    if (browser.contextualIdentities !== undefined) {
      this._tablist.contextualIdentities.forEach(identity => {
        browser.menus.create({
          parentId: "contextMenuOpenInContextualTab",
          id: `contextMenuOpenInContextualTab_${identity.cookieStoreId}`,
          title: identity.name,
          icons: {
            "16": `/sidebar/img/contextual-identities/${identity.icon}.svg#${identity.color}`
          },
          contexts: ["tab"],
          viewTypes: ["sidebar"],
          documentUrlPatterns: [`moz-extension://${location.host}/*`]
        });
      });
    }

    browser.menus.overrideContext({
      context: "tab",
      tabId: tabId
    });
  }
}

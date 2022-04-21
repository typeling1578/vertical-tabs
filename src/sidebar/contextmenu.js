/* global browser, location */

import Sidetab from "./sidetab.js";

const HAS_PRIVILEGED_SCHEME = /^(about|chrome|data|file|javascript|resource):*/;

export default class ContextMenu {
  constructor(sidebar, tablist) {
    this._sidebar = sidebar;
    this._tablist = tablist;
    let count;

    browser.menus.onClicked.addListener((info, tab) => this._onContextMenuClicked(info, tab));
  }

  async _getTabs(ctab) {
    let tabs = [];
    const tab = await browser.tabs.get(ctab.id);
    if (tab.active || tab.highlighted) {
      const tabs_ = await browser.tabs.query({ currentWindow: true });
      for (const tab_ of tabs_) {
        if (tab_.active || tab_.highlighted) {
          tabs.push(tab_);
        }
      }
    } else {
      tabs.push(tab);
    }
    return tabs;
  }

  async _onContextMenuClicked(info, tab) {
    if (
      !tab ||
      !this._tablist.checkWindow(tab.windowId) ||
      !info.menuItemId.startsWith("contextMenu")
    ) {
      return;
    }
    const tabs = await this._getTabs(tab);
    const reverse_tabs = tabs.slice().reverse();
    switch (info.menuItemId) {
      case "contextMenuReloadTab":
        for (const tab_ of tabs) {
          await browser.tabs.reload(tab_.id);
        }
        return;
      case "contextMenuMuteTab":
        for (const tab_ of tabs) {
          await browser.tabs.update(tab_.id, { muted: !tab_.mutedInfo.muted });
        }
        return;
      case "contextMenuPinTab":
        for (const tab_ of tabs) {
          await browser.tabs.update(tab_.id, { pinned: !tab_.pinned });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return;
      case "contextMenuDuplicateTab":
        for (const tab_ of tabs) {
          await browser.tabs.duplicate(tab_.id);
        }
        return;
      case "contextMenuUnloadTab":
        for (const tab_ of tabs) {
          await browser.tabs.discard(tab_.id);
        }
        return;
      case "contextMenuMoveTabToStart":
        for (const tab_ of reverse_tabs) {
          this._tablist.moveTabToStart(tab_);
        }
        return;
      case "contextMenuMoveTabToEnd":
        for (const tab_ of tabs) {
          this._tablist.moveTabToEnd(tab_);
        }
        return;
      case "contextMenuMoveTabToNewWindow":
        await browser.windows.create({ tabId: tab.id });
        return;
      case "contextMenuCloseTabsBefore":
        this._tablist.closeTabsBefore(tab);
        return;
      case "contextMenuCloseTabsAfter":
        this._tablist.closeTabsAfter(tab);
        return;
      case "contextMenuCloseOtherTabs":
        this._tablist.closeAllTabsExcept(tab);
        return;
      case "contextMenuUndoCloseTab":
        this._tablist.undoCloseTab();
        return;
      case "contextMenuCloseTab":
        let tabIds = [];
        for (const tab_ of tabs) {
          tabIds.push(tab_.id);
        }
        await browser.tabs.remove(tabIds);
        return;
    }

    if (!info.menuItemId.startsWith("contextMenuOpenInContextualTab_")) {
      return;
    }
    this._tablist.createTab({
      cookieStoreId: info.menuItemId.split("contextMenuOpenInContextualTab_")[1],
      openerTabId: tab.id,
      url: tab.url,
    });
  }

  open(e) {
    if (!Sidetab.isTabEvent(e, false)) {
      e.preventDefault();
      return;
    }
    browser.menus.removeAll();

    const tabId = Sidetab.tabIdForEvent(e);
    const tab = this._tablist.getTabById(tabId);
    const identityItems = this._sidebar.getContextualIdentityItems(tab.cookieStoreId);

    const items = [
      {
        id: "contextMenuReloadTab",
        title: browser.i18n.getMessage("contextMenuReloadTab"),
      },
      {
        id: "contextMenuMuteTab",
        title: browser.i18n.getMessage(tab.muted ? "contextMenuUnmuteTab" : "contextMenuMuteTab"),
      },
      {
        id: "contextMenuPinTab",
        title: browser.i18n.getMessage(tab.pinned ? "contextMenuUnpinTab" : "contextMenuPinTab"),
      },
      {
        id: "contextMenuDuplicateTab",
        title: browser.i18n.getMessage("contextMenuDuplicateTab"),
        enabled: ContextMenu.canOpen(tab.url),
      },
      {
        id: "contextMenuUnloadTab",
        title: browser.i18n.getMessage("contextMenuUnloadTab"),
        enabled: ContextMenu.canUnload(tab),
      },
      {
        type: "separator",
      },
      /*
       * We don’t have “Add to bookmarks” because it requires us to code the dialog.
       * Also, it’s not very useful since you can bookmark the active tab easily anyway.
       */ {
        id: "contextMenuOpenInContextualTab",
        title: browser.i18n.getMessage("contextMenuOpenInContextualTab"),
        enabled: ContextMenu.canOpen(tab.url),
        visible: identityItems.length !== 0 && !this._sidebar.incognito,
      },
      {
        id: "contextMenuMoveTab",
        title: browser.i18n.getMessage("contextMenuMoveTab"),
        enabled: this._tablist.hasTabsBefore(tab) || this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToStart",
        title: browser.i18n.getMessage("contextMenuMoveTabToStart"),
        enabled: this._tablist.hasTabsBefore(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToEnd",
        title: browser.i18n.getMessage("contextMenuMoveTabToEnd"),
        enabled: this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToNewWindow",
        title: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
      },
      {
        type: "separator",
      },
      {
        id: "contextMenuCloseTabs",
        title: browser.i18n.getMessage("contextMenuCloseTabs"),
        visible: !this._tablist.isFilterActive(),
        enabled: this._tablist.tabCount() > 1 && !tab.pinned,
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseTabsBefore",
        title: browser.i18n.getMessage("contextMenuCloseTabsBefore"),
        enabled: this._tablist.hasTabsBefore(tab),
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseTabsAfter",
        title: browser.i18n.getMessage("contextMenuCloseTabsAfter"),
        enabled: this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseOtherTabs",
        title: browser.i18n.getMessage("contextMenuCloseOtherTabs"),
      },
      {
        id: "contextMenuUndoCloseTab",
        title: browser.i18n.getMessage("contextMenuUndoCloseTab"),
        enabled: this._tablist.hasRecentlyClosedTabs,
      },
      {
        id: "contextMenuCloseTab",
        title: browser.i18n.getMessage("contextMenuCloseTab"),
      },
    ];

    for (const identityItem of identityItems) {
      items.push({
        ...identityItem,
        id: `contextMenuOpenInContextualTab_${identityItem["id"]}`,
        parentId: "contextMenuOpenInContextualTab",
      });
    }

    for (const item of items) {
      browser.menus.create({
        ...item,
        contexts: ["tab"],
        viewTypes: ["sidebar"],
        documentUrlPatterns: [`moz-extension://${location.host}/*`],
      });
    }

    // overrideContext can only be called in `tab` or `bookmark` context
    // so we need to pass a tabId to open a native context menu
    browser.menus.overrideContext({
      context: "tab",
      tabId: tabId,
    });
  }

  static canUnload(tab) {
    // Trying to discard an about: tab fails silently
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1631157
    return (
      tab.url === "about:blank" ||
      tab.url === "about:newtab" ||
      (!tab.active && !tab.discarded && !tab.url.startsWith("about:"))
    );
  }

  static canOpen(url) {
    return url === "about:blank" || url === "about:newtab" || !HAS_PRIVILEGED_SCHEME.test(url);
  }
}

/* global browser, location */

import { openTab } from "./utils.js";
import Sidetab from "./sidetab.js";
import getContextualIdentityItems from "./contextualidentities.js";

const IS_PRIVILEGED_PAGE_URL = /^(about|chrome|data|file|javascript):*/;

export default class ContextMenu {
  constructor(tablist) {
    this._tablist = tablist;
    let count;

    browser.menus.onClicked.addListener((info, tab) => this._onContextMenuClicked(info, tab));
  }

  _onContextMenuClicked(info, tab) {
    if (
      !tab ||
      !this._tablist.checkWindow(tab.windowId) ||
      !info.menuItemId.startsWith("contextMenu")
    ) {
      return;
    }
    switch (info.menuItemId) {
      case "contextMenuReloadTab":
        browser.tabs.reload(tab.id);
        return;
      case "contextMenuMuteTab":
        browser.tabs.update(tab.id, { muted: !tab.mutedInfo.muted });
        return;
      case "contextMenuPinTab":
        browser.tabs.update(tab.id, { pinned: !tab.pinned });
        return;
      case "contextMenuDuplicateTab":
        this._tablist.duplicate(tab);
        return;
      case "contextMenuUnloadTab":
        browser.tabs.discard(tab.id);
        return;
      case "contextMenuMoveTabToStart":
        this._tablist.moveTabToStart(tab);
        return;
      case "contextMenuMoveTabToEnd":
        this._tablist.moveTabToEnd(tab);
        return;
      case "contextMenuMoveTabToNewWindow":
        browser.windows.create({ tabId: tab.id });
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
        browser.tabs.remove(tab.id);
        return;
    }

    if (!info.menuItemId.startsWith("contextMenuOpenInContextualTab_")) {
      return;
    }
    openTab({
      cookieStoreId: info.menuItemId.split("contextMenuOpenInContextualTab_")[1],
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

    const items = [
      {
        id: "contextMenuReloadTab",
        title: browser.i18n.getMessage("contextMenuReloadTab"),
        icons: { "16": "/sidebar/img/refresh.svg" },
      },
      {
        id: "contextMenuMuteTab",
        title: browser.i18n.getMessage(tab.muted ? "contextMenuUnmuteTab" : "contextMenuMuteTab"),
        icons: tab.muted
          ? { "16": "/sidebar/img/audio-sound.svg" }
          : { "16": "/sidebar/img/audio-mute.svg" },
      },
      {
        type: "separator",
      },
      {
        id: "contextMenuPinTab",
        title: browser.i18n.getMessage(tab.pinned ? "contextMenuUnpinTab" : "contextMenuPinTab"),
        icons: tab.pinned ? { "16": "/sidebar/img/unpin.svg" } : { "16": "/sidebar/img/pin.svg" },
      },
      {
        id: "contextMenuDuplicateTab",
        title: browser.i18n.getMessage("contextMenuDuplicateTab"),
        icons: { "16": "/sidebar/img/copy.svg" },
        enabled: ContextMenu.canOpen(tab.url),
      },
      {
        id: "contextMenuUnloadTab",
        title: browser.i18n.getMessage("contextMenuUnloadTab"),
        icons: { "16": "/sidebar/img/quit.svg" },
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
        icons: { "16": "/sidebar/img/containers.svg" },
        visible:
          browser.contextualIdentities !== undefined &&
          !document.body.classList.contains("incognito"),
      },
      {
        id: "contextMenuMoveTab",
        title: browser.i18n.getMessage("contextMenuMoveTab"),
        icons: { "16": "/sidebar/img/move.svg" },
        enabled: this._tablist.hasTabsBefore(tab) || this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToStart",
        title: browser.i18n.getMessage("contextMenuMoveTabToStart"),
        icons: { "16": "/sidebar/img/move-to-start.svg" },
        enabled: this._tablist.hasTabsBefore(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToEnd",
        title: browser.i18n.getMessage("contextMenuMoveTabToEnd"),
        icons: { "16": "/sidebar/img/move-to-end.svg" },
        enabled: this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuMoveTab",
        id: "contextMenuMoveTabToNewWindow",
        title: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
        icons: { "16": "/sidebar/img/open-in-new.svg" },
      },
      {
        type: "separator",
      },
      {
        id: "contextMenuCloseTabs",
        title: browser.i18n.getMessage("contextMenuCloseTabs"),
        icons: { "16": "/sidebar/img/cancel.svg" },
        visible: !this._tablist.isFilterActive(),
        enabled: this._tablist.tabCount() > 1 && !tab.pinned,
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseTabsBefore",
        title: browser.i18n.getMessage("contextMenuCloseTabsBefore"),
        icons: { "16": "/sidebar/img/arrowhead-up.svg" },
        enabled: this._tablist.hasTabsBefore(tab),
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseTabsAfter",
        title: browser.i18n.getMessage("contextMenuCloseTabsAfter"),
        icons: { "16": "/sidebar/img/arrowhead-down.svg" },
        enabled: this._tablist.hasTabsAfter(tab),
      },
      {
        parentId: "contextMenuCloseTabs",
        id: "contextMenuCloseOtherTabs",
        title: browser.i18n.getMessage("contextMenuCloseOtherTabs"),
        icons: { "16": "/sidebar/img/arrowhead-up-down.svg" },
      },
      {
        id: "contextMenuUndoCloseTab",
        title: browser.i18n.getMessage("contextMenuUndoCloseTab"),
        icons: { "16": "/sidebar/img/undo.svg" },
        enabled: this._tablist.hasRecentlyClosedTabs,
      },
      {
        id: "contextMenuCloseTab",
        title: browser.i18n.getMessage("contextMenuCloseTab"),
        icons: { "16": "/sidebar/img/close.svg" },
      },
    ];

    const identityItems = getContextualIdentityItems();
    if (identityItems !== null) {
      identityItems.forEach(identityItem => {
        identityItem["id"] = `contextMenuOpenInContextualTab_${identityItem["id"]}`;
        items.push({
          parentId: "contextMenuOpenInContextualTab",
          ...identityItem,
        });
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
    return (
      !tab.active &&
      !tab.discarded &&
      !tab.url.startsWith("about:") &&
      !tab.url.startsWith("chrome:")
    );
  }

  static canOpen(url) {
    return !IS_PRIVILEGED_PAGE_URL.test(url) || url === "about:newtab" || url === "about:blank";
  }
}

/* global browser, requestAnimationFrame */

import fuzzysort from "fuzzysort";
import smoothScrollIntoView from "smooth-scroll-into-view-if-needed";

import { COMPACT_MODE, SWITCH_BY_SCROLLING, throttled } from "../common.js";
import Sidetab from "./sidetab.js";
import ContextMenu from "./contextmenu.js";

const NOTIFICATION_DELETE_ID = "notification-delete";
// HACK: keep in sync with animation time in CSS
const TAB_ANIMATION_TIME_MS = 100;

export default class Tablist {
  /* @arg {props}
   * windowId
   * search
   * prefs
   */
  constructor(sidebar) {
    this._windowId = sidebar.windowId;
    this._incognito = sidebar.incognito;
    this._prefs = sidebar.prefs;
    this._filter = sidebar.filter.bind(sidebar);
    this._firefoxVersion = sidebar.firefoxVersion;

    this._tabs = new Map();
    this._active = null;
    this.__tabsShrinked = false;
    this._filterActive = false;

    this._willMoveTimeout = null;
    this._isDraggingSince = null;
    this._openInNewWindowTimer = null;
    this._highlightBottomScrollShadowTimer = null;
    this._willBeDeletedIds = null;
    this._willBeDeletedWasActive = null;

    this._view = document.getElementById("tablist");
    this._topVisibilityChecker = document.getElementById("top-visibility-checker");
    this._bottomVisibilityChecker = document.getElementById("bottom-visibility-checker");
    this._pinnedview = document.getElementById("pinnedtablist");
    this._wrapperView = document.getElementById("tablist-wrapper");
    this._spacerView = document.getElementById("spacer");
    this._moreTabsView = document.getElementById("moretabs");
    this._moreTabsView.textContent = browser.i18n.getMessage("allTabsLabel");

    this._initCanScrollShadowObservers();

    this._populate();
    this._setupListeners();

    this._updateHasRecentlyClosedTabs();
    this.tabContextMenu = new ContextMenu(sidebar, this);
  }

  _setupListeners() {
    // Tab events
    browser.tabs.onCreated.addListener((tab) => this._onBrowserTabCreated(tab));
    browser.tabs.onActivated.addListener((activeInfo) => this._onBrowserTabActivated(activeInfo));
    browser.tabs.onHighlighted.addListener((highlightInfo) => this._onBrowserTabHighlighted(highlightInfo));
    browser.tabs.onUpdated.addListener(
      (tabId, changeInfo, tab) => this._onBrowserTabUpdated(tabId, changeInfo, tab),
      { windowId: this._windowId }, // only onUpdated lets us filter by windowId
    );
    browser.tabs.onRemoved.addListener((tabId, removeInfo) =>
      this._onBrowserTabRemoved(tabId, removeInfo.windowId, removeInfo.isWindowClosing),
    );
    browser.tabs.onMoved.addListener((tabId, moveInfo) => this._onBrowserTabMoved(tabId, moveInfo));
    browser.tabs.onAttached.addListener((tabId, attachInfo) =>
      this._onBrowserTabAttached(tabId, attachInfo),
    );
    browser.tabs.onDetached.addListener((tabId, detachInfo) =>
      this._onBrowserTabRemoved(tabId, detachInfo.oldWindowId, false),
    );
    browser.webNavigation.onCompleted.addListener((details) =>
      this._webNavigationOnCompleted(details),
    );

    // Global ("event-bubbling") listeners
    // Because defining event listeners for each tab is a terrible idea.
    // Read more here: https://davidwalsh.name/event-delegate
    for (const view of [this._view, this._pinnedview]) {
      view.addEventListener("click", (e) => this._onClick(e), { passive: false });
      view.addEventListener("auxclick", (e) => this._onAuxClick(e), { passive: false });
      view.addEventListener("mousedown", (e) => this._onMouseDown(e), { passive: false });
      view.addEventListener("pointerover", (e) => this._onPointerOver(e));
      view.addEventListener("contextmenu", (e) => this.tabContextMenu.open(e), {
        passive: false,
        capture: true,
      });
      view.addEventListener("animationend", (e) => this._onAnimationEnd(e));
    }

    this._wrapperView.addEventListener("pointerout", (e) => this._onPointerOut(e));

    this._spacerView.addEventListener("dblclick", () => this._onSpacerDblClick());
    this._spacerView.addEventListener("auxclick", (e) => this._onSpacerAuxClick(e));
    this._moreTabsView.addEventListener("click", () => this._clearSearch());

    // Drag-and-drop.
    document.addEventListener("dragstart", (e) => this._onDragStart(e), { passive: false });
    document.addEventListener("dragover", (e) => this._onDragOver(e), { passive: false });
    document.addEventListener("dragleave", (e) => this._onDragLeave(e));
    document.addEventListener("drop", (e) => this._onDrop(e));
    document.addEventListener("dragend", (e) => this._onDragend(e));

    this._onWheel = throttled((e) => this.__onWheel(e), 20);
    window.addEventListener(
      "wheel",
      (e) => {
        // disable zooming
        if (e.metaKey || e.ctrlKey || this._scrollShouldSwitch(e)) {
          e.preventDefault();
        }
        this._onWheel(e);
      },
      { passive: false },
    );

    // Handle notifications
    browser.notifications.onClicked.addListener((notificationId) =>
      this._onNotificationDeleteClicked(notificationId),
    );
    browser.notifications.onClosed.addListener((notificationId) =>
      this._onNotificationDeleteClosed(notificationId),
    );
  }

  async _initCanScrollShadowObservers() {
    const scrollingOptions = {
      root: this._view,
      rootMargin: "0px",
      threshold: [0, 1],
    };
    const scrollingObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        const classToApply =
          entry.target.id === "top-visibility-checker" ? "can-scroll-top" : "can-scroll-bottom";
        this._wrapperView.classList.toggle(classToApply, !entry.isIntersecting);
      }
    }, scrollingOptions);

    scrollingObserver.observe(this._topVisibilityChecker);
    scrollingObserver.observe(this._bottomVisibilityChecker);
  }

  _getVisibleTabs() {
    return [...this._tabs.values()].filter((tab) => tab.isVisible());
  }

  _onBrowserTabCreated(tab) {
    clearTimeout(this._openInNewWindowTimer);
    if (!this.checkWindow(tab.windowId)) {
      return;
    }
    this._shiftTabsIndexes(1, tab.index);
    this._create(tab);
  }

  async _onBrowserTabAttached(tabId, { newWindowId, newPosition }) {
    if (!this.checkWindow(newWindowId)) {
      return;
    }
    this._shiftTabsIndexes(1, newPosition);
    const tab = await browser.tabs.get(tabId);
    this._create(tab);
  }

  _onBrowserTabRemoved(tabId, windowId, isWindowClosing) {
    if (!this.checkWindow(windowId) || isWindowClosing) {
      return;
    }
    const sidetab = this.getTabById(tabId);
    this._shiftTabsIndexes(-1, sidetab.index);
    this._remove(sidetab);
    this._updateHasRecentlyClosedTabs();
  }

  _onBrowserTabActivated(activeInfo) {
    if (!this.checkWindow(activeInfo.windowId)) {
      return;
    }
    const sidetab = this.getTabById(activeInfo.tabId);
    if (!sidetab) {
      // if tab is not moved yet from one window to another
      return;
    }
    this._setActive(sidetab);
    this._maybeUpdateTabThumbnail(sidetab);
    this.scrollIntoView(sidetab);
  }

  _onBrowserTabHighlighted(highlightInfo) {
    if (!this.checkWindow(highlightInfo.windowId)) {
      return;
    }
    let highlight = [];
    for (const tabId of highlightInfo.tabIds) {
      const sidetab = this.getTabById(tabId);
      if (sidetab) {
        highlight.push(sidetab);
      }
    }
    this._setHighlight(highlight);
  }

  _onBrowserTabMoved(tabId, moveInfo) {
    if (!this.checkWindow(moveInfo.windowId)) {
      return;
    }
    this._willMoveTimeout = setTimeout(() => {
      this.__onBrowserTabMoved(tabId, moveInfo);
    }, 10);
  }

  __onBrowserTabMoved(tabId, moveInfo) {
    this._willMoveTimeout = null;
    const sidetab = this.getTabById(tabId);
    this._updateTabIndex(sidetab, moveInfo);
    if (sidetab.hidden) {
      return;
    }
    // if another extension uses tabs.duplicate(), it is necessary
    // because the tab will never finish its transition and .being-added will stay
    sidetab.view.classList.remove("being-added");
    this._appendTabView(sidetab, false);
    this.scrollIntoView(sidetab);
  }

  _updateTabIndex(sidetab, moveInfo) {
    const { fromIndex, toIndex } = moveInfo;
    const direction = fromIndex < toIndex ? -1 : 1;
    const start = direction > 0 ? toIndex : fromIndex + 1;
    const end = direction > 0 ? fromIndex : toIndex + 1;
    this._shiftTabsIndexes(direction, start, end);
    sidetab.index = toIndex;
  }

  _onBrowserTabUpdated(tabId, changeInfo, tab) {
    // we don’t filter by windowId because it’s already filtered in the listener
    const sidetab = this.getTabById(tabId);
    if (!sidetab) {
      // if tab hasn’t yet been created in our tablist
      return;
    }

    if (!changeInfo.hasOwnProperty("favIconUrl")) {
      // to work around https://bugzilla.mozilla.org/show_bug.cgi?id=1450384
      changeInfo["favIconUrl"] = tab.favIconUrl;
    }
    sidetab.update(changeInfo);

    if (changeInfo.hasOwnProperty("hidden")) {
      if (changeInfo.hidden) {
        this._removeTabView(sidetab);
      } else {
        this._appendTabView(sidetab);
      }
    }

    if (changeInfo.hasOwnProperty("pinned")) {
      this._onTabPinned(sidetab, changeInfo.pinned);
    }

    if (changeInfo.hasOwnProperty("status") && changeInfo.status === "complete") {
      this._maybeUpdateTabThumbnail(sidetab);
    }

    if (changeInfo.hasOwnProperty("discarded") && changeInfo.discarded === true) {
      this._onTabDiscarded(sidetab);
    }
  }

  // Shift tabs indexes with indexes between |start| and |end| (|end| not included)
  // by |offset| (can be a negative number).
  _shiftTabsIndexes(offset, start, end = null) {
    for (const tab of this._tabs.values()) {
      if (tab.index >= start && (end === null || tab.index < end)) {
        tab.index += offset;
      }
    }
  }

  _webNavigationOnCompleted({ tabId, frameId }) {
    if (frameId !== 0) {
      // We only care about top-level frames.
      return;
    }
    const sidetab = this.getTabById(tabId);
    if (!sidetab) {
      // Could be null because different window.
      return;
    }
    sidetab.burst();
  }

  _onMouseDown(e) {
    // Prevent autoscrolling on middle click on Windows
    // It should be in onMouseDown, it doesn’t in onPointerDown on some Windows 10.
    // https://framagit.org/ariasuni/tabcenter-reborn/-/issues/88
    if (e.button === 1) {
      e.preventDefault();
    }
  }

  _onPointerOver(e) {
    const tabId = Sidetab.tabIdForEvent(e);
    if (!tabId) {
      //The tab may have been closed
      return;
    }
    clearTimeout(this._shrinkTabsTimer);
    if (tabId === this._active.id) {
      this.scrollIntoView(this._active);
    }
  }

  _onPointerOut(e) {
    this._shrinkTabsTimer = setTimeout(
      () => this._wrapperView.classList.toggle("shrinked", this._tabsShrinked),
      300,
    );
  }

  _onAuxClick(e) {
    if (e.button === 1 && Sidetab.isTabEvent(e, false)) {
      browser.tabs.remove(Sidetab.tabIdForEvent(e));
      e.preventDefault();
    }
  }

  scrollIntoView(tab) {
    // Pinned tabs are always into view!
    if (tab.pinned) {
      return;
    }
    const scrollBehavior = !this._prefs.animations
      ? "instant"
      : getComputedStyle(this._view).getPropertyValue("scroll-behavior");
    smoothScrollIntoView(tab.view, {
      scrollMode: "if-needed",
      block: "nearest",
      behavior: scrollBehavior === "smooth" ? "smooth" : "instant",
    });
  }

  _highlightBottomScrollShadow() {
    clearTimeout(this._highlightBottomScrollShadowTimer);
    this._wrapperView.classList.add("highlight-scroll-bottom");
    this._highlightBottomScrollShadowTimer = setTimeout(
      () => this._wrapperView.classList.remove("highlight-scroll-bottom"),
      500,
    );
  }

  _onClick(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (Sidetab.isCloseButtonEvent(e)) {
      const tabId = Sidetab.tabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (Sidetab.isIconOverlayEvent(e)) {
      const tabId = Sidetab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      browser.tabs.update(tabId, { muted: !tab.muted });
    } else if (e.button === 0 && Sidetab.isTabEvent(e)) {
      const tabId = Sidetab.tabIdForEvent(e);
      if (e.ctrlKey) {
        browser.tabs.get(tabId).then((tab) => {
          if (tab.highlighted) {
            browser.tabs.update(tabId, { highlighted: false });
          } else {
            browser.tabs.update(tabId, { highlighted: true, active: false });
          }
        });
      } else if (e.shiftKey) {
        browser.tabs.query({ currentWindow: true }).then((tabs) => {
          const activetab = tabs.find((tab) => tab.active);
          const activetab_index = tabs.indexOf(activetab);
          const tab = tabs.find((tab) => tab.id === tabId);
          const tab_index = tabs.indexOf(tab);
          if (tab_index > activetab_index) {
            for (let i = activetab_index; i <= tab_index; i++) {
              browser.tabs.update(tabs[i].id, { highlighted: true, active: false });
            }
          } else if (tab_index < activetab_index) {
            for (let i = tab_index; i <= activetab_index; i++) {
              browser.tabs.update(tabs[i].id, { highlighted: true, active: false });
            }
          }
        })
      } else if (this._prefs.switchLastActiveTab && this._tabs.size > 1) {
        browser.tabs.query({ currentWindow: true }).then((tabs) => {
          tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
          browser.tabs.update(tabs[1].id, { active: true });
        });
      } else {
        if (this._highlight) {
          for (const tab of this._highlight) {
            browser.tabs.update(tab.id, { highlighted: false });
          }
        }
        browser.tabs.update(tabId, { active: true });
      }

      if (this._filterActive) {
        this._filter("");
      }
      return;
    }
  }

  _onDragStart(e) {
    if (Sidetab.isCloseButtonEvent(e)) {
      e.preventDefault();
      return;
    }

    this._isDraggingSince = null;
    if (!Sidetab.isTabEvent(e) || this._filterActive) {
      return;
    }

    const tabId = Sidetab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    //trick to show the "move" effect when dragging over tab viewport.
    e.dataTransfer.setData("text/uri-list", "");
    e.dataTransfer.setData(
      "text/x-verticaltabs-tab",
      JSON.stringify({
        tabId: tabId,
        origWindowId: this._windowId,
      }),
    );
    e.dataTransfer.setData(
      "text/x-moz-place",
      JSON.stringify({
        type: "text/x-moz-place",
        title: tab.title,
        uri: tab.url,
      }),
    );
    e.dataTransfer.dropEffect = "move";
  }

  // return tab with the provided pinned state and index, if it exists
  _getTabByIndex(index, pinned) {
    return this._getVisibleTabs()
      .filter((tab) => tab.pinned === pinned)
      .find((tab) => tab.index === index);
  }

  _getTabBefore(currentTab, samePinnedStatus = false) {
    let previousTab = null;
    for (const tab of this._getVisibleTabs()) {
      if (
        tab.index < currentTab.index &&
        (!previousTab || tab.index > previousTab.index) &&
        (!samePinnedStatus || tab.pinned === currentTab.pinned)
      ) {
        previousTab = tab;
      }
    }
    return previousTab;
  }

  _getTabAfter(currentTab, samePinnedStatus = false) {
    let nextTab = null;
    for (const tab of this._getVisibleTabs()) {
      if (
        tab.index > currentTab.index &&
        (!nextTab || tab.index < nextTab.index) &&
        (!samePinnedStatus || tab.pinned === currentTab.pinned)
      ) {
        nextTab = tab;
      }
    }
    return nextTab;
  }

  _getLastTab(pinned) {
    let lastTab = null;
    for (const tab of this._getVisibleTabs()) {
      if (tab.pinned === pinned && (!lastTab || tab.index > lastTab.index)) {
        lastTab = tab;
      }
    }
    return lastTab;
  }

  // whereToDropInfo.tab === null if tablist is empty or we are over the topmenu
  _whereToDrop(e) {
    if (this._isEventForId(e, "topmenu")) {
      return null;
    }

    const dropTabId = Sidetab.tabIdForEvent(e);
    if (!dropTabId) {
      const lastTab = this._getLastTab(e.target === this._pinnedview);
      return {
        tab: lastTab ? lastTab : null,
        before: false,
      };
    }

    const dropTab = this.getTabById(dropTabId);
    const rect = dropTab.view.getBoundingClientRect();
    const isOnFirstHalf =
      dropTab.pinned && this._prefs.compactPins
        ? e.clientX < rect.x + rect.width / 2
        : e.clientY < rect.y + rect.height / 2;
    if (isOnFirstHalf) {
      const previousTab = this._getTabBefore(dropTab, true);
      if (previousTab) {
        return {
          tab: previousTab,
          before: false,
        };
      }
    }
    return {
      tab: dropTab,
      before: isOnFirstHalf,
    };
  }

  _removeDragHighlight() {
    for (const tabView of document.querySelectorAll(
      ".drag-highlight-previous,.drag-highlight-next",
    )) {
      tabView.classList.remove("drag-highlight-previous", "drag-highlight-next");
    }
  }

  _onDragOver(e) {
    // This is from there that the real drag is starting and that you will be able to drop a tab
    this._isDraggingSince = Date.now();
    e.preventDefault();

    const whereToDropInfo = this._whereToDrop(e);
    if (whereToDropInfo === null || whereToDropInfo.tab === null) {
      return;
    }

    this._removeDragHighlight();
    const { tab, before } = whereToDropInfo;
    tab.view.classList.toggle("drag-highlight-previous", before);
    tab.view.classList.toggle("drag-highlight-next", !before);
  }

  _onDragLeave(e) {
    this._removeDragHighlight();
  }

  _findMozURL(dataTransfer) {
    const urlData = dataTransfer.getData("text/x-moz-url-data"); // page link
    if (urlData) {
      return urlData;
    }
    const mozPlaceData = dataTransfer.getData("text/x-moz-place"); // bookmark
    if (mozPlaceData) {
      return JSON.parse(mozPlaceData).uri;
    }
    return null;
  }

  async _onDrop(e) {
    this._isDraggingSince = null;
    clearTimeout(this._openInNewWindowTimer);

    this._removeDragHighlight();

    // if this is a topmenu event, do not move the tab
    const isTopmenuEvent = this._isEventForId(e, "topmenu");
    const isFilterboxInputEvent = this._isEventForId(e, "filterbox-input");
    if (isTopmenuEvent && !isFilterboxInputEvent) {
      return;
    }

    let whereToDropInfo;
    if (!isFilterboxInputEvent) {
      whereToDropInfo = this._whereToDrop(e);
      if (whereToDropInfo === null) {
        return;
      }
    }

    const dt = e.dataTransfer;
    const tabJson = dt.getData("text/x-verticaltabs-tab");
    if (tabJson) {
      const tabDroppedData = JSON.parse(tabJson);
      if (isFilterboxInputEvent) {
        const tabDroppedUrl = this.getTabById(tabDroppedData.tabId).url;
        this._filter(this._getUrlCore(tabDroppedUrl));
      } else {
        await this._handleDroppedSidetab(e, tabDroppedData, whereToDropInfo);
      }
      return;
    }

    const { tab, before } = whereToDropInfo;
    let newIndex;
    if (tab === null) {
      newIndex = -1;
    } else {
      newIndex = before ? tab.index : tab.index + 1;
    }

    const mozURL = this._findMozURL(dt);
    if (mozURL) {
      this.createTab({
        windowId: this._windowId,
        active: false,
        url: mozURL,
        pinned: tab.pinned,
        index: newIndex,
      });
      return;
    }

    const query = dt.getData("text/plain");
    if (query) {
      const newTab = await this.createTab({ active: false, pinned: tab.pinned, index: newIndex });
      browser.search.search({ query, tabId: newTab.id });
      return;
    }
  }

  _isEventForId(e, id) {
    let elem = e.target;
    while (true) {
      if (elem.id === id) {
        return true;
      }
      elem = elem.parentNode;
      if (elem === null) {
        return false;
      }
    }
  }

  async _handleDroppedSidetab(e, dragTabInfo, whereToDropInfo) {
    const toDuplicate = e.ctrlKey;

    const dragTabs = [];
    let tab_ = await browser.tabs.get(dragTabInfo.tabId);
    if (tab_.active || tab_.highlighted) {
      let tabs = await browser.tabs.query({ windowId: dragTabInfo.origWindowId });
      tabs = tabs.sort((a, b) => a.index - b.index);
      for (const tab of tabs) {
        if (tab.active || tab.highlighted) {
          dragTabs.push(tab);
        }
      }
    } else {
      dragTabs.push(tab_);
    }
    let { tab, before } = whereToDropInfo;
    let old_tab;
    for (const dragTab of dragTabs) {
      if (old_tab) {
        tab = await browser.tabs.get(old_tab.id);
      }
      let newIndex;
      if (tab === null) {
        newIndex = -1;
      } else {
        if (old_tab) {
          before = false;
        }
        newIndex = before ? tab.index : tab.index + 1;
        // when moving a tab in the same window, the tab is first removed then inserted
        // so the index has to be decremented to match the earlier removal
        if (this.checkWindow(dragTabInfo.origWindowId) && dragTab.index < newIndex && !toDuplicate) {
          newIndex -= 1;
        }
      }

      if (toDuplicate) {
        let duplicatedtab = await this.duplicate(dragTab, {
          windowId: this._windowId,
          active: false,
          index: newIndex,
          pinned: tab ? tab.pinned : false,
        });
        old_tab = duplicatedtab;
      } else {
        await browser.tabs.update(dragTab.id, { pinned: tab ? tab.pinned : false });
        await browser.tabs.move(dragTab.id, {
          windowId: this._windowId,
          index: newIndex,
        });
        if (!this.checkWindow(dragTabInfo.origWindowId)) {
          await browser.tabs.update(dragTab.id, { active: true });
        }
        old_tab = dragTab;
      }
    }
  }

  _getUrlCore(url_string) {
    const url = new URL(url_string);
    if (url.protocol === "https:" || url.protocol === "http:") {
      // easiest way to remove username, password, port, path, parameters, fragment from URL
      return url.hostname;
    } else {
      // about:, file:///, chrome://, data:, chrome://, moz-extension://, resource://, view-source:
      // Used rarely so most likely only protocol is useful for filtering
      return url_string.match(/^[\w-]*:\/*/)[0];
    }
  }

  _onDragend(e) {
    //listen for bookmark creation
    const __onBookmarkCreated = (id, bookmarkInfo) => {
      clearTimeout(this._openInNewWindowTimer);
      browser.bookmarks.onCreated.removeListener(__onBookmarkCreated);
    };

    browser.bookmarks.onCreated.addListener(__onBookmarkCreated);

    this._openInNewWindowTimer = setTimeout(() => {
      // drag-and-dropping a tab for a few pixels quickly can trigger dragover but still not drop
      // so we also check that it’s not a misclick (drag and drop events just seem unreliable…)
      if (this._isDraggingSince === null || Date.now() - this._isDraggingSince < 100) {
        return;
      }
      if (this._tabs.size === 1) {
        return;
      }

      const tabId = Sidetab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      // if tab has been moved to another window
      if (!tab) {
        return;
      }
      browser.windows.create({ tabId: tabId });
      browser.bookmarks.onCreated.removeListener(__onBookmarkCreated);
    }, 200);
  }

  __onWheel(e) {
    if (this._scrollShouldSwitch(e)) {
      this._activateTabFromCurrent(e.deltaY);
    }
  }

  _scrollShouldSwitch(e) {
    return (
      this._prefs.switchByScrolling === SWITCH_BY_SCROLLING.ALWAYS ||
      (this._prefs.switchByScrolling === SWITCH_BY_SCROLLING.WITH_CTRL && e.ctrlKey)
    );
  }

  _onSpacerDblClick() {
    this.createTab({}, { successorTab: true });
  }

  _onSpacerAuxClick(e) {
    if (e.button === 1) {
      this.createTab({}, { successorTab: true });
    }
  }

  _onAnimationEnd(e) {
    const tabId = Sidetab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    if (tab) {
      tab.onAnimationEnd(e);
    }
  }

  _onNotificationDeleteClicked(notificationId) {
    if (notificationId !== NOTIFICATION_DELETE_ID) {
      return;
    }

    const tabIds = this._willBeDeletedIds;
    this._willBeDeletedIds = null;
    for (const tab of this._tabs.values()) {
      if (tabIds.includes(tab.id)) {
        tab.updateWillBeDeletedHidden(false);
      }
    }
    if (this._willBeDeletedWasActive !== null) {
      browser.tabs.update(this._willBeDeletedWasActive, { active: true });
      this._willBeDeletedWasActive = null;
    }
  }

  _onNotificationDeleteClosed(notificationId) {
    if (notificationId !== NOTIFICATION_DELETE_ID || this._willBeDeletedIds === null) {
      return;
    }
    browser.tabs.remove(this._willBeDeletedIds);
    this._willBeDeletedIds = null;
    this._willBeDeletedWasActive = null;
  }

  _clearSearch() {
    // _clearSearch() is called every time we open a new tab (see _create()),
    // which subsequently calls the expensive filter() method.
    // _filterActive provides a fast-path for the common-case where there is
    // no search going on.
    if (!this._filterActive) {
      return;
    }
    this._filter("");
  }

  filter(query) {
    // if filter wasn’t active and there is no query, there is nothing to do
    if (!this._filterActive && query.length === 0) {
      return;
    }
    this._filterActive = query.length > 0;

    const tabs = [...this._tabs.values()];
    let notShown = 0;
    let pinnedTabShown = 0;
    // if there is a query, update the results
    if (query.length) {
      const results = fuzzysort
        .go(query, tabs, {
          keys: ["title", "_formattedUrl"],
          allowTypo: false,
          threshold: -1000,
        })
        .sort((r1, r2) => r2.score - r1.score)
        .reduce((acc, tabResult, index) => {
          tabResult.order = index;
          acc[tabResult.obj.id] = tabResult;
          return acc;
        }, {});
      for (const tab of tabs) {
        const result = results[tab.id];
        const hidden = !result;
        tab.updateSearchHidden(hidden);
        tab.resetHighlights();
        if (!hidden) {
          if (tab.pinned) {
            pinnedTabShown += 1;
          }
          if (result[0]) {
            // title
            tab.highlightTitle(fuzzysort.highlight(result[0], "<b>", "</b>"));
          }
          if (result[1]) {
            // host
            tab.highlightHost(fuzzysort.highlight(result[1], "<b>", "</b>"));
          }
        } else {
          notShown += 1;
        }
      }
      this._pinnedview.classList.toggle("hidden", pinnedTabShown === 0);
      // otherwise we display again all the tabs
    } else {
      for (const tab of tabs) {
        tab.updateSearchHidden(false);
        tab.resetHighlights();
      }
      this._pinnedview.classList.remove("hidden");
    }
    this._moreTabsView.classList.toggle("hasMoreTabs", notShown > 0);
    this._maybeShrinkTabs();
  }

  async _populate() {
    const tabs = await browser.tabs.query({ windowId: this._windowId });
    // Sort the tabs by index so we can insert them in sequence.
    tabs.sort((a, b) => a.index - b.index);
    const pinnedFragment = document.createDocumentFragment();
    const unpinnedFragment = document.createDocumentFragment();
    let activeTab = null;
    for (const tab of tabs) {
      const sidetab = this.__create(tab);
      if (tab.active) {
        activeTab = sidetab;
      }
      if (!tab.hidden) {
        const fragment = tab.pinned ? pinnedFragment : unpinnedFragment;
        fragment.appendChild(sidetab.view);
      }
    }
    this._pinnedview.appendChild(pinnedFragment);
    this._view.insertBefore(unpinnedFragment, this._bottomVisibilityChecker);
    this._maybeShrinkTabs(true);
    if (activeTab !== null) {
      this.scrollIntoView(activeTab);
      this._maybeUpdateTabThumbnail(activeTab);
    }
    this._initCanScrollShadowObservers();

    requestAnimationFrame(() => {
      document.body.classList.add("loaded");
      requestAnimationFrame(() => {
        document.body.classList.toggle("animated", this._prefs.animations);
      });
    });
  }

  checkWindow(windowId) {
    return windowId === this._windowId;
  }

  getTabById(tabId) {
    return this._tabs.get(tabId, null);
  }

  setCompactPins() {
    this._pinnedview.classList.toggle("compact", this._prefs.compactPins);
  }

  get _tabsShrinked() {
    return this.__tabsShrinked;
  }

  set _tabsShrinked(shrinked) {
    this.__tabsShrinked = shrinked;
    this._onPointerOut(null);
  }

  _maybeShrinkTabs(immediate = false) {
    // Avoid an expensive sync reflow (offsetHeight).
    requestAnimationFrame(() => {
      this.__maybeShrinkTabs(immediate);
    });
  }

  __maybeShrinkTabs(immediate) {
    if (!this._animation) {
      immediate = true;
    }

    if (this._prefs.compactMode !== COMPACT_MODE.DYNAMIC) {
      this._tabsShrinked = this._prefs.compactMode === COMPACT_MODE.STRICT;
      if (immediate) {
        this._wrapperView.classList.toggle("shrinked", this._tabsShrinked);
      }
      return;
    }

    const wrapperHeight = this._wrapperView.offsetHeight;
    const pinnedViewHeight = this._pinnedview.offsetHeight;
    const style = getComputedStyle(document.body);
    let notCompactTabHeight = parseInt(
      style.getPropertyValue("--tab-height-normal").split("px")[0],
    );
    if (Number.isNaN(notCompactTabHeight)) {
      notCompactTabHeight = 52;
    }
    const maxHeight = wrapperHeight - notCompactTabHeight / 2;
    const visibleTabs = this._getVisibleTabs();

    // Can we fit everything without shrinking tabs?

    if (!this._tabsShrinked) {
      const spaceLeft = this._spacerView.offsetHeight;
      const unpinnedTabCount = visibleTabs.filter((tab) => !tab.pinned).length;

      // count one more tab to only unshrink if there is a comfortable white space underneath
      if ((unpinnedTabCount + 1) * notCompactTabHeight + pinnedViewHeight > maxHeight) {
        this._tabsShrinked = true;
        if (immediate) {
          this._wrapperView.classList.toggle("shrinked", this._tabsShrinked);
        }
      }
      return;
    }

    // Could we fit everything if we switched back to the "normal" mode?

    // account for two tabs more, one more than above, so we don’t switch too often back and forth
    let estimatedHeight = notCompactTabHeight * 2;

    // take the "Show All Tabs" element displayed when filtering tabs into account
    estimatedHeight += this._moreTabsView.offsetHeight;

    let numPinnedTabs = 0;
    for (const tab of visibleTabs) {
      if (!tab.pinned) {
        estimatedHeight += notCompactTabHeight;
      } else {
        numPinnedTabs++;
      }
    }
    estimatedHeight +=
      this._prefs.compactPins && numPinnedTabs > 0
        ? this._pinnedview.offsetHeight
        : numPinnedTabs * notCompactTabHeight;

    if (estimatedHeight <= maxHeight) {
      this._tabsShrinked = false;
      if (immediate) {
        this._wrapperView.classList.toggle("shrinked", this._tabsShrinked);
      }
    }
  }

  async createTab(props, options = {}) {
    if (options.hasOwnProperty("position")) {
      if (options.position === "afterCurrent") {
        props.index = this._active.index + 1;
      } else {
        props.index = this._tabs.size;
      }
    }

    if (props["url"] === "about:newtab") {
      delete props["url"];
    }

    if (!this._incognito && props["cookieStoreId"] === undefined) {
      props["cookieStoreId"] = "firefox-default";
    }

    const newTab = await browser.tabs.create(props);

    if (options["successorTab"] === true) {
      browser.tabs.update(newTab.id, { successorTabId: this._active.id });
    }
  }

  __create(tabInfo) {
    const tab = new Sidetab(tabInfo);
    this._tabs.set(tabInfo.id, tab);
    if (tabInfo.active) {
      this._setActive(tab);
    }
    return tab;
  }

  _create(tabInfo) {
    const sidetab = this.__create(tabInfo);
    // Bail early and don't insert the tab in the DOM: we'll do it later
    // if the tab becomes visible.
    if (tabInfo.hidden) {
      return;
    }
    this._clearSearch();
    this._appendTabView(sidetab);
    this._maybeShrinkTabs();
    this.scrollIntoView(sidetab);
  }

  _setActive(sidetab) {
    if (this._active) {
      if (this._active.id === sidetab.id) {
        return;
      }
      this._active.updateActive(false);
    }
    sidetab.updateActive(true);
    this._active = sidetab;
  }

  _setHighlight(sidetabs) {
    if (this._highlight) {
      for (const sidetab of this._highlight) {
        sidetab.updateHighlight(false);
      }
    }
    this._highlight = [];
    for (const sidetab of sidetabs) {
      sidetab.updateHighlight(true);
      this._highlight.push(sidetab);
    }
  }

  _remove(sidetab) {
    if (this._active.id === sidetab.id) {
      this._active = null;
    }
    this._removeTabView(sidetab);
    this._tabs.delete(sidetab.id);
    this._maybeShrinkTabs();
  }

  _appendTabView(sidetab, animate = true) {
    const element = sidetab.view;
    // if another extension uses tabs.duplicate(), it is necessary
    // because the tab will never finish its transition and .being-added will stay
    element.classList.remove("being-added");
    const parent = sidetab.pinned ? this._pinnedview : this._view;
    const tabAfter = this._getTabAfter(sidetab, true);
    const spaceLeft = this._spacerView.offsetHeight;
    const wrapperHeight = this._wrapperView.offsetHeight;
    if (
      this._prefs.animations &&
      animate &&
      (sidetab.pinned ||
        (!tabAfter && spaceLeft !== 0) ||
        (tabAfter && tabAfter.view.offsetHeight <= wrapperHeight))
    ) {
      element.classList.add("added", "being-added");
      setTimeout(() => element.classList.remove("being-added"), TAB_ANIMATION_TIME_MS);
    }
    const newElem = tabAfter
      ? parent.insertBefore(element, tabAfter.view)
      : sidetab.pinned
      ? parent.appendChild(element)
      : parent.insertBefore(element, this._bottomVisibilityChecker);
    setTimeout(() => newElem.classList.remove("added"), 20);
  }

  _removeTabView(sidetab) {
    if (!this._prefs.animations) {
      sidetab.view.remove();
      return;
    }
    // when we (un)pin a tab, we want two views animating at the same so we make a copy
    const oldView = sidetab.view.cloneNode(true);
    sidetab.view.parentNode.replaceChild(oldView, sidetab.view);
    setTimeout(() => {
      oldView.classList.add("deleted");
      setTimeout(() => oldView.remove(), TAB_ANIMATION_TIME_MS);
    }, 20);
  }

  _onTabPinned(sidetab, pinned) {
    // Sometimes, e.g. when reopening a pinned tab, onUpdated reports a change by mistake
    if (sidetab.pinned === pinned) {
      return;
    }
    this._removeTabView(sidetab);
    sidetab.pinned = pinned;
    if (sidetab.pinned && this._compactPins) {
      sidetab.resetThumbnail();
    }
    if (this._willMoveTimeout === null) {
      this._appendTabView(sidetab);
      this._maybeShrinkTabs();
      if (sidetab.active) {
        this.scrollIntoView(sidetab);
      }
    }
  }

  _onTabDiscarded(sidetab) {
    sidetab.updateDiscarded(true);
  }

  _maybeUpdateTabThumbnail(sidetab) {
    if (this._tabsShrinked || (sidetab.pinned && this._prefs.compactPins)) {
      return;
    }
    sidetab.updateThumbnail();
  }

  async _deleteTabs(currentTabId, tabIds) {
    if (!this._prefs.notifyClosingManyTabs || tabIds.length < 4) {
      browser.tabs.remove(tabIds);
      return;
    }

    if (this._willBeDeletedIds !== null) {
      for (const tabId of this._willBeDeletedIds) {
        tabIds.splice(tabIds.indexOf(tabId), 1);
      }
      await browser.tabs.remove(this._willBeDeletedIds);
      this._willBeDeletedIds = null;
      this._willBeDeletedWasActive = null;
    }

    // apparently, we need those two await to prevent
    // _onNotificationDeleteClosed() to be triggered too late
    await browser.notifications.clear(NOTIFICATION_DELETE_ID);
    await browser.notifications.create(NOTIFICATION_DELETE_ID, {
      type: "basic",
      title: browser.i18n.getMessage("notificationDeletedTitle", tabIds.length),
      message: browser.i18n.getMessage("notificationDeletedMessage"),
    });

    this._willBeDeletedIds = tabIds;
    for (const tab of this._tabs.values()) {
      if (tabIds.includes(tab.id)) {
        tab.updateWillBeDeletedHidden(true);
        if (tab.active) {
          browser.tabs.update(currentTabId, { active: true });
          this._willBeDeletedWasActive = tab.id;
        }
      }
    }
  }

  /*
   * Functions below are used by ContextMenu
   */
  tabCount(pinned = null) {
    if (pinned === null) {
      return this._getVisibleTabs().length;
    }
    return this._getVisibleTabs().filter((tab) => tab.pinned === pinned).length;
  }

  isFilterActive() {
    return this._filterActive;
  }

  // We can’t make the function that overrides context menu asynchronous,
  // so we get this information ahead of time.
  async _updateHasRecentlyClosedTabs() {
    const undoTabs = await this._getRecentlyClosedTabs();
    this.hasRecentlyClosedTabs = undoTabs.length > 0;
  }

  async _getRecentlyClosedTabs() {
    const sessions = await browser.sessions.getRecentlyClosed();
    return sessions.reduce((acc, session) => {
      if (session.tab && this.checkWindow(session.tab.windowId)) {
        acc.push(session.tab);
      }
      return acc;
    }, []);
  }

  /* tabs.duplicate() is limited and buggy in Firefox < 79:
   * - Doesn’t provide an option to open the duplicated tab at a given index (< 68)
   *   https://bugzilla.mozilla.org/show_bug.cgi?id=1560218
   * - First reports that the duplicated tab is pinned even when it isn’t (< 68)
   *   https://bugzilla.mozilla.org/show_bug.cgi?id=1563380
   * - The duplicated tab is not immediately made active (< 79)
   *   https://bugzilla.mozilla.org/show_bug.cgi?id=1376088
   * We use this function instead of having to use ugly workarounds.
   */
  async duplicate(tab, props) {
    if (this._firefoxVersion >= "79.0") {
      const newProps = {};
      if (props) {
        for (const [key, value] of Object.entries(props)) {
          if (key === "index" || index === "active") {
            newProps[key] = value;
          }
        }
      }

      let tab = await browser.tabs.duplicate(tab.id, newProps);
      return tab;
    }

    const defaultProps = {
      active: true,
      cookieStoreId: tab.cookieStoreId,
      index: tab.pinned
        ? Math.min(
            ...this._getVisibleTabs()
              .filter((tab) => !tab.pinned)
              .map((tab) => tab.index),
          )
        : tab.index + 1,
      openerTabId: tab.openerTabId,
      openInReaderMode: tab.openInReaderMode,
      pinned: false,
      url: tab.url,
    };
    const newProps = Object.assign(defaultProps, props);
    this.createTab(newProps);
  }

  moveTabToStart(currentTab) {
    const minIndex = Math.min(...this._tabsBefore(currentTab).map((tab) => tab.index));
    browser.tabs.move(currentTab.id, { index: minIndex });
  }

  moveTabToEnd(currentTab) {
    const maxIndex = Math.max(...this._tabsAfter(currentTab).map((tab) => tab.index));
    browser.tabs.move(currentTab.id, { index: maxIndex });
  }

  _tabsBefore(currentTab) {
    return this._getVisibleTabs().filter(
      (tab) => tab.index < currentTab.index && tab.pinned === currentTab.pinned,
    );
  }

  hasTabsBefore(currentTab) {
    // This function uses some() which is faster than filter(),
    // since it stops as soon at it founds a match
    return this._getVisibleTabs().some(
      (tab) => tab.index < currentTab.index && tab.pinned === currentTab.pinned,
    );
  }

  closeTabsBeforeCount(currentTab) {
    return this._tabsBefore(currentTab).length;
  }

  closeTabsBefore(currentTab) {
    this._deleteTabs(
      currentTab.id,
      this._tabsBefore(currentTab).map((tab) => tab.id),
    );
  }

  _tabsAfter(currentTab) {
    return this._getVisibleTabs().filter(
      (tab) => tab.index > currentTab.index && tab.pinned === currentTab.pinned,
    );
  }

  hasTabsAfter(currentTab) {
    return this._getVisibleTabs().some(
      (tab) => tab.index > currentTab.index && tab.pinned === currentTab.pinned,
    );
  }

  closeTabsAfterCount(currentTab) {
    return this._tabsAfter(currentTab).length;
  }

  closeTabsAfter(currentTab) {
    this._deleteTabs(
      currentTab.id,
      this._tabsAfter(currentTab).map((tab) => tab.id),
    );
  }

  closeAllTabsExceptCount(tabId) {
    return this._allTabsExcept(tabId).length;
  }

  closeAllTabsExcept(currentTab) {
    this._deleteTabs(
      currentTab.id,
      this._allTabsExcept(currentTab.id).map((tab) => tab.id),
    );
  }

  _allTabsExcept(tabId) {
    return this._getVisibleTabs().filter((tab) => tab.id !== tabId && !tab.pinned && !tab.hidden);
  }

  async undoCloseTab() {
    const undoTabs = await this._getRecentlyClosedTabs();
    if (undoTabs.length !== 0) {
      browser.sessions.restore(undoTabs[0].sessionId);
      this.hasRecentlyClosedTabs = undoTabs.length >= 2;
    }
  }

  _activateTabFromCurrent(incr) {
    const currentTab = this._active;
    let tab;
    const sortedTabs = this._getVisibleTabs().sort((a, b) => a.index - b.index);
    if (incr > 0) {
      // activate next tab
      tab = this._getTabAfter(currentTab) || sortedTabs[0];
    } else {
      // activate previous tab
      tab = this._getTabBefore(currentTab) || sortedTabs.reverse()[0];
    }
    browser.tabs.update(tab.id, { active: true });
  }
}

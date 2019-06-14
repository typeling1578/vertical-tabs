/* global browser, requestAnimationFrame */

import SideTab from "./tab.js";
import ContextMenu from "./contextmenu.js";

const fuzzysort = require("fuzzysort");

const COMPACT_MODE_OFF = 0;
/* const COMPACT_MODE_DYNAMIC = 1; */
const COMPACT_MODE_STRICT = 2;

export default class TabList {
  /* @arg {props}
   * windowId
   * openTab
   * search
   * prefs
   */
  constructor(props) {
    this._props = props;
    this._tabs = new Map();
    this._active = null;
    this.__compactPins = true;
    this.__tabsShrinked = true;
    this._windowId = props.windowId;
    this._filterActive = false;
    this._willMoveTimeout = null;
    this._isDragging = false;
    this._openInNewWindowTimer = null;
    this._highlightBottomScrollShadowTimer = null;
    this._firstAndLastTabObserver = null;
    this._firstTabView = null;
    this._lastTabView = null;
    this._view = document.getElementById("tablist");
    this._pinnedview = document.getElementById("pinnedtablist");
    this._wrapperView = document.getElementById("tablist-wrapper");
    this._spacerView = document.getElementById("spacer");
    this._moreTabsView = document.getElementById("moretabs");
    this._moreTabsView.textContent = browser.i18n.getMessage("allTabsLabel");

    this._compactModeMode = parseInt(this._props.prefs.compactModeMode);
    this._compactPins = this._props.prefs.compactPins;
    this._switchLastActiveTab = this._props.prefs.switchLastActiveTab;
    this._warnBeforeClosing = this._props.prefs.warnBeforeClosing;

    this._setupListeners();
    this._populate();

    browser.browserSettings.closeTabsByDoubleClick.get({}).then(({ value }) => {
      this.closeTabsByDoubleClick = value;
    });

    this._updateHasRecentlyClosedTabs();
    this.tabContextMenu = new ContextMenu(this);
  }

  _setupListeners() {
    // Tab events
    browser.tabs.onCreated.addListener(tab => this._onBrowserTabCreated(tab));
    browser.tabs.onActivated.addListener(activeInfo => this._onBrowserTabActivated(activeInfo));
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
    browser.webNavigation.onCompleted.addListener(details =>
      this._webNavigationOnCompleted(details),
    );

    // Global ("event-bubbling") listeners
    // Because defining event listeners for each tab is a terrible idea.
    // Read more here: https://davidwalsh.name/event-delegate
    for (const view of [this._view, this._pinnedview]) {
      view.addEventListener("click", e => this._onClick(e));
      view.addEventListener("dblclick", e => this._onDblClick(e));
      view.addEventListener("auxclick", e => this._onAuxClick(e));
      view.addEventListener("mousedown", e => this._onMouseDown(e));
      view.addEventListener("mouseup", e => this._onMouseUp(e));
      view.addEventListener("mouseover", e => this._onMouseOver(e));
      view.addEventListener("contextmenu", e => this.tabContextMenu.open(e), true);
      view.addEventListener("animationend", e => this._onAnimationEnd(e));
    }

    this._spacerView.addEventListener("dblclick", () => this._onSpacerDblClick());
    this._spacerView.addEventListener("auxclick", e => this._onSpacerAuxClick(e));
    this._moreTabsView.addEventListener("click", () => this._clearSearch());

    // Drag-and-drop.
    document.addEventListener("dragstart", e => this._onDragStart(e));
    document.addEventListener("dragover", e => this._onDragOver(e));
    document.addEventListener("dragenter", e => this._onDragEnter(e));
    document.addEventListener("dragleave", e => this._onDragLeave(e));
    document.addEventListener("drop", e => this._onDrop(e));
    document.addEventListener("dragend", e => this._onDragend(e));

    // Disable zooming.
    document.addEventListener("wheel", e => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
      }
    });

    // Pref changes
    browser.storage.onChanged.addListener(changes => this._onPrefsChanged(changes));
  }

  _initializeFirstAndLastTabsObserver() {
    const onObserve = entries => {
      entries.forEach(entry => {
        if (this._firstTabView && entry.target.id === this._firstTabView.id) {
          this.__toggleShadow(entry, "can-scroll-top");
        } else if (this._lastTabView && entry.target.id === this._lastTabView.id) {
          this.__toggleShadow(entry, "can-scroll-bottom");
        }
      });
    };
    if (!this._firstAndLastTabObserver) {
      const options = {
        root: document.querySelector("#tablist"),
        rootMargin: "0px",
        threshold: [0, 1],
      };
      this._firstAndLastTabObserver = new IntersectionObserver(onObserve, options);
    }
    this._setFirstAndLastTabObserver();
  }

  __toggleShadow(entry, className) {
    if (entry.intersectionRatio === 1) {
      //tab is totally visible, don't show shadow
      this._wrapperView.classList.remove(className);
    } else {
      this._wrapperView.classList.add(className);
    }
  }

  _setFirstAndLastTabObserver() {
    if (!this._tabs.size) {
      return;
    }

    const tabViews = this._view.querySelectorAll(".tab:not(.hidden):not(.deleted)");

    if (tabViews.length <= 2) {
      this._unObserveTab(this._firstTabView);
      this._unObserveTab(this._lastTabView);
      this._wrapperView.classList.remove("can-scroll-top", "can-scroll-bottom");
      return;
    }

    const newFirstTabView = tabViews[0];
    const newLastTabView = tabViews[tabViews.length - 1];
    this.__observeFirstTab(newFirstTabView);
    this.__observeLastTab(newLastTabView);
  }

  __observeFirstTab(newFirstTabView) {
    if (this._firstTabView) {
      if (this._firstTabView === newFirstTabView) {
        return;
      }
      this._firstAndLastTabObserver.unobserve(this._firstTabView);
    }

    this._firstTabView = newFirstTabView;
    this._firstAndLastTabObserver.observe(this._firstTabView);
  }

  __observeLastTab(newLastTabView) {
    if (this._lastTabView) {
      if (this._lastTabView === newLastTabView) {
        return;
      }
      this._firstAndLastTabObserver.unobserve(this._lastTabView);
    }

    if (this._view.firstChild !== newLastTabView) {
      this._lastTabView = newLastTabView;
      this._firstAndLastTabObserver.observe(this._lastTabView);
    }
  }

  _unObserveTab(tabView) {
    if (!tabView) {
      return;
    }
    if (tabView === this._firstTabView) {
      this._firstAndLastTabObserver.unobserve(this._firstTabView);
      this._firstTabView = null;
    } else if (tabView === this._lastTabView) {
      this._firstAndLastTabObserver.unobserve(this._lastTabView);
      this._lastTabView = null;
    }
  }

  _onPrefsChanged(changes) {
    if (changes.compactModeMode) {
      this._compactModeMode = parseInt(changes.compactModeMode.newValue);
    }
    if (changes.compactPins) {
      this._compactPins = changes.compactPins.newValue;
    }
    if (changes.switchLastActiveTab) {
      this._switchLastActiveTab = changes.switchLastActiveTab.newValue;
    }
    if (changes.warnBeforeClosing) {
      this._warnBeforeClosing = changes.warnBeforeClosing.newValue;
    }
    this._maybeShrinkTabs();
  }

  _onBrowserTabCreated(tab) {
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
    // tab info passed because of https://bugzilla.mozilla.org/show_bug.cgi?id=1450384
    sidetab.onUpdate(changeInfo, tab);

    if (changeInfo.hasOwnProperty("hidden")) {
      if (changeInfo.hidden) {
        this._removeTabView(sidetab);
      } else {
        this._appendTabView(sidetab);
      }
    }

    if (changeInfo.hasOwnProperty("pinned")) {
      this._onTabPinned(sidetab);
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
    // Prevent autoscrolling on middle click
    if (e.button === 1) {
      e.preventDefault();
    }
  }

  _onMouseUp(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (e.button === 0 && SideTab.isTabEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      if (tabId !== this._active) {
        browser.tabs.update(tabId, { active: true });
      } else if (this._switchLastActiveTab && this._tabs.size > 1) {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
          browser.tabs.update(tabs[1].id, { active: true });
        });
      }

      this._props.search("");
      return;
    }
    // Prevent autoscrolling on middle click
    if (e.button === 1) {
      e.preventDefault();
    }
  }

  _onMouseOver(e) {
    const tabId = SideTab.tabIdForEvent(e);
    if (!tabId) {
      //The tab may have been closed
      return;
    }
    if (tabId === this._active) {
      this.scrollIntoView(this.getTabById(tabId));
    }
  }

  _onAuxClick(e) {
    if (e.button === 1 && SideTab.isTabEvent(e, false)) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
      e.preventDefault();
    }
  }

  scrollIntoView(tab) {
    // Pinned tabs are always into view!
    if (tab.pinned) {
      return;
    }
    this._scrollIntoViewIfNeeded(tab);
    // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1139745#c7
    // we still make a first scrollIntoView so that it starts scrolling right away
    setTimeout(() => this._scrollIntoViewIfNeeded(tab), 100);
    // also we scroll when a tab has finished animating
    setTimeout(() => this._scrollIntoViewIfNeeded(tab), 300);
  }

  _scrollIntoViewIfNeeded(tab) {
    const { top: parentTop, height } = this._view.getBoundingClientRect();
    const { top, bottom } = tab.view.getBoundingClientRect();
    // if new tab is not at least partially hidden, there’s nothing to do
    if (!(top < parentTop || bottom > parentTop + height)) {
      return;
    }

    const activeTab = this.getTabById(this._active);
    // if tab is active or if active tab is pinned, active tab can’t get outside view
    if (tab.id === this._active || activeTab.pinned) {
      tab.view.scrollIntoView({ block: "nearest" });
      return;
    }

    // check if scrolling to new tab won’t push active tab out of view
    const { top: activeTop } = activeTab.view.getBoundingClientRect();
    if (activeTop + height < bottom) {
      // ask browser to scroll only if active tab is not already on top
      if (activeTop !== parentTop) {
        activeTab.view.scrollIntoView(true);
      }
      // notify that an opened tab has been opened partially or totally outside view
      this._highlightBottomScrollShadow();
    } else {
      tab.view.scrollIntoView({ block: "nearest" });
    }
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
    if (SideTab.isCloseButtonEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (SideTab.isIconOverlayEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      browser.tabs.update(tabId, { muted: !tab.muted });
    }
  }

  _onDblClick(e) {
    if (SideTab.isTabEvent(e) && this.closeTabsByDoubleClick) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
    }
  }

  _onDragStart(e) {
    if (!SideTab.isTabEvent(e) || this._filterActive) {
      return;
    }

    this._isDragging = true;

    const tabId = SideTab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    //trick to show the "move" effect when dragging over tab viewport.
    e.dataTransfer.setData("text/uri-list", "");
    e.dataTransfer.setData(
      "text/x-tabcenter-tab",
      JSON.stringify({
        tabId: parseInt(tabId),
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

  _onDragOver(e) {
    e.preventDefault();
  }

  _onDragEnter(e) {
    if (!SideTab.isTabEvent(e)) {
      return;
    }

    const dragTabInfoStr = e.dataTransfer.getData("text/x-tabcenter-tab");

    if (!dragTabInfoStr) {
      return;
    }

    const dragTabInfo = JSON.parse(dragTabInfoStr);
    const dragTab = this.getTabById(dragTabInfo.tabId);
    const dragTabPos = dragTab.index;
    const dropTabId = SideTab.tabIdForEvent(e);
    const dropTab = this.getTabById(dropTabId);
    const dropTabPos = dropTab.index;

    if (dragTab.id === dropTabId) {
      return;
    }

    if (dragTab.pinned !== dropTab.pinned) {
      return;
    }

    dragTabPos > dropTabPos
      ? dropTab.view.classList.add("drag-highlight-previous")
      : dropTab.view.classList.add("drag-highlight-next");
  }

  _onDragLeave(e) {
    if (!SideTab.isTabEvent(e)) {
      return;
    }

    const dropTabId = SideTab.tabIdForEvent(e);
    const dropTab = this.getTabById(dropTabId);
    dropTab.view.classList.remove("drag-highlight-previous", "drag-highlight-next");
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

  _onDrop(e) {
    if (!this._isEventForId(e, "searchbox")) {
      e.preventDefault();
    }
    this._isDragging = false;
    clearTimeout(this._openInNewWindowTimer);

    // if this is a topmenu event, do not move the tab
    if (this._isEventForId(e, "topmenu")) {
      return;
    }

    const dt = e.dataTransfer;
    const tabJson = dt.getData("text/x-tabcenter-tab");
    if (tabJson) {
      this._handleDroppedTabCenterTab(e, JSON.parse(tabJson));
      return;
    }

    const mozURL = this._findMozURL(dt);
    if (mozURL) {
      this._props.openTab({
        url: mozURL,
        windowId: this._windowId,
      });
      return;
    }

    const tabStr = dt.getData("text/plain");
    if (tabStr) {
      browser.search.search({ query: tabStr });
      return;
    }

    console.info("Unknown drag-and-drop operation. Aborting.");
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

  _handleDroppedTabCenterTab(e, tab) {
    const { tabId, origWindowId } = tab;
    if (!this.checkWindow(origWindowId)) {
      browser.tabs.move(tabId, { windowId: this._windowId, index: -1 });
      browser.tabs.update(tabId, { active: true });
      return;
    }

    const curTab = this.getTabById(tabId);

    if (e.target === this._spacerView || e.target === this._moreTabsView) {
      this.moveTabToEnd(curTab);
      return;
    }

    const dropTabId = SideTab.tabIdForEvent(e);

    if (tabId === dropTabId) {
      return;
    }

    const dropTab = this.getTabById(dropTabId);

    if (curTab.pinned !== dropTab.pinned) {
      // They can't mix
      if (curTab.pinned) {
        // We tried to move a pinned tab to the non-pinned area, move it to the last
        // position of the pinned tabs.
        this.moveTabToEnd(curTab);
      } else {
        // Reverse of the previous statement
        this.moveTabToStart(curTab);
      }
      return;
    }

    dropTab.view.classList.remove("drag-highlight-previous", "drag-highlight-next");

    const curTabPos = curTab.index;
    const dropTabPos = dropTab.index;
    const newPos =
      curTabPos < dropTabPos ? Math.min(this._tabs.size, dropTabPos) : Math.max(0, dropTabPos);
    browser.tabs.move(tabId, { index: newPos });
  }

  _onDragend(e) {
    //listen for bookmark creation
    const __onBookmarkCreated = (id, bookmarkInfo) => {
      clearTimeout(this._openInNewWindowTimer);
      browser.bookmarks.onCreated.removeListener(__onBookmarkCreated);
    };

    browser.bookmarks.onCreated.addListener(__onBookmarkCreated);

    this._openInNewWindowTimer = setTimeout(() => {
      if (this._isDragging === false) {
        return;
      }
      this._isDragging = false;
      if (this._tabs.size === 1) {
        return;
      }

      const tabId = SideTab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      // if tab has been moved to another window
      if (!tab) {
        return;
      }
      browser.windows.create({ tabId: tabId });
      browser.bookmarks.onCreated.removeListener(__onBookmarkCreated);
    }, 50);
  }

  _onSpacerDblClick() {
    this._props.openTab();
  }

  _onSpacerAuxClick(e) {
    if (e.button === 1) {
      this._props.openTab();
    }
  }

  _onAnimationEnd(e) {
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    if (tab) {
      tab.onAnimationEnd(e);
    }
  }

  _clearSearch() {
    // _clearSearch() is called every time we open a new tab (see _create()),
    // which subsequently calls the expensive filter() method.
    // _filterActive provides a fast-path for the common-case where there is
    // no search going on.
    if (!this._filterActive) {
      return;
    }
    this._props.search("");
    this._setFirstAndLastTabObserver();
  }

  filter(query) {
    // if filter wasn’t active and there is no query, there is nothing to do
    if (!this._filterActive && query.length === 0) {
      return;
    }
    this._filterActive = query.length > 0;

    const tabs = [...this._tabs.values()];
    let notShown = 0;
    // if there is a query, update the results
    if (query.length) {
      const results = fuzzysort
        .go(query, tabs, {
          keys: ["title", "host"],
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
        const show = !!result;
        tab.updateVisibility(show);
        tab.resetHighlights();
        if (show) {
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
      // otherwise we display again all the tabs
    } else {
      for (const tab of tabs) {
        tab.updateVisibility(true);
        tab.resetHighlights();
      }
    }
    this._moreTabsView.classList.toggle("hasMoreTabs", notShown > 0);
    this._maybeShrinkTabs();
    this._setFirstAndLastTabObserver();
  }

  async _populate() {
    const tabs = await browser.tabs.query({ windowId: this._windowId });
    // Sort the tabs by index so we can insert them in sequence.
    tabs.sort((a, b) => a.index - b.index);
    const pinnedFragment = document.createDocumentFragment();
    const unpinnedFragment = document.createDocumentFragment();
    let activeTab;
    for (const tab of tabs) {
      const sidetab = this.__create(tab);
      if (tab.active) {
        activeTab = sidetab;
      }
      const fragment = tab.pinned ? pinnedFragment : unpinnedFragment;
      if (!tab.hidden) {
        fragment.appendChild(sidetab.view);
      }
    }
    this._pinnedview.appendChild(pinnedFragment);
    this._view.appendChild(unpinnedFragment);
    this._maybeShrinkTabs();
    if (activeTab) {
      this._maybeUpdateTabThumbnail(activeTab);
      this.scrollIntoView(activeTab);
    }
    this._initializeFirstAndLastTabsObserver();
  }

  checkWindow(windowId) {
    return windowId === this._windowId;
  }

  getTabById(tabId) {
    return this._tabs.get(tabId, null);
  }

  get _compactPins() {
    return this.__compactPins;
  }

  set _compactPins(compact) {
    this.__compactPins = compact;
    this._pinnedview.classList.toggle("compact", compact);
  }

  get _tabsShrinked() {
    return this.__tabsShrinked;
  }

  set _tabsShrinked(shrinked) {
    this.__tabsShrinked = shrinked;
    this._wrapperView.classList.toggle("shrinked", shrinked);
  }

  _maybeShrinkTabs() {
    // Avoid an expensive sync reflow (offsetHeight).
    requestAnimationFrame(() => {
      this.__maybeShrinkTabs();
    });
  }

  __maybeShrinkTabs() {
    if (
      this._compactModeMode === COMPACT_MODE_STRICT ||
      this._compactModeMode === COMPACT_MODE_OFF
    ) {
      this._tabsShrinked = this._compactModeMode === COMPACT_MODE_STRICT;
      return;
    }

    const wrapperHeight = this._wrapperView.offsetHeight;
    const pinnedViewHeight = this._pinnedview.offsetHeight;
    const notCompactTabHeight = 52; // Doesn’t work exactly if CSS is customized
    const maxHeight = wrapperHeight - notCompactTabHeight / 2;

    // Can we fit everything without shrinking tabs?

    if (!this._tabsShrinked) {
      const spaceLeft = this._spacerView.offsetHeight;
      const unpinnedTabCount = Array.from(this._tabs.values()).filter(
        tab => !tab.pinned && tab.visible && !tab.hidden,
      ).length;

      if (unpinnedTabCount * notCompactTabHeight + pinnedViewHeight > maxHeight) {
        this._tabsShrinked = true;
      }
      return;
    }

    // Could we fit everything if we switched back to the "normal" mode?

    // account for one tab more so we don’t switch too often back and forth
    let estimatedHeight = notCompactTabHeight;

    // take the "Show All Tabs" element displayed when filtering tabs into account
    estimatedHeight += this._moreTabsView.offsetHeight;

    let numPinnedTabs = 0;
    for (const tab of this._tabs.values()) {
      if (tab.visible) {
        if (!tab.pinned) {
          estimatedHeight += notCompactTabHeight;
        } else {
          numPinnedTabs++;
        }
      }
    }
    estimatedHeight +=
      this._compactPins && numPinnedTabs > 0
        ? this._pinnedview.offsetHeight
        : numPinnedTabs * notCompactTabHeight;

    if (estimatedHeight <= maxHeight) {
      this._tabsShrinked = false;
    }
  }

  __create(tabInfo) {
    const tab = new SideTab();
    this._tabs.set(tabInfo.id, tab);
    tab.init(tabInfo);
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
      if (this._active === sidetab.id) {
        return;
      }
      this.getTabById(this._active).updateActive(false);
    }
    sidetab.updateActive(true);
    this._active = sidetab.id;
  }

  _remove(sidetab) {
    if (this._active === sidetab.id) {
      this._active = null;
    }
    //remove observer before to remove the view
    this._unObserveTab(sidetab.view);
    this._removeTabView(sidetab);
    this._tabs.delete(sidetab.id);
    this._maybeShrinkTabs();
  }

  _appendTabView(sidetab, animate = true) {
    const element = sidetab.view;
    const parent = sidetab.pinned ? this._pinnedview : this._view;
    // Can happen with browser.tabs.closeWindowWithLastTab set to true or during
    // session restore.
    if (!this._tabs.size) {
      parent.appendChild(element);
      return;
    }
    const tabAfter = [...this._tabs.values()]
      .filter(tab => tab.pinned === sidetab.pinned && !tab.hidden)
      .sort((a, b) => a.index - b.index)
      .find(tab => tab.index > sidetab.index);
    const spaceLeft = this._spacerView.offsetHeight;
    const wrapperHeight = this._wrapperView.offsetHeight;
    if (
      animate &&
      (sidetab.pinned ||
        (!tabAfter && spaceLeft !== 0) ||
        (tabAfter && tabAfter.view.offsetHeight <= wrapperHeight))
    ) {
      element.classList.add("added");
    }
    const newElem = tabAfter
      ? parent.insertBefore(element, tabAfter.view)
      : parent.appendChild(element);
    setTimeout(() => newElem.classList.remove("added"), 20);
    this._setFirstAndLastTabObserver();
  }

  _removeTabView(sidetab) {
    sidetab.view.addEventListener("transitionend", () => sidetab.view.remove());
    sidetab.view.classList.add("deleted");
    this._setFirstAndLastTabObserver();
  }

  _onTabPinned(sidetab) {
    this._removeTabView(sidetab);
    sidetab.updatePinned(!sidetab.pinned);
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
    if (this._tabsShrinked || (sidetab.pinned && this._compactPins)) {
      return;
    }
    sidetab.updateThumbnail();
  }

  /*
   * Functions below are used by ContextMenu
   */
  tabCount(pinned = null) {
    if (pinned === null) {
      return this._tabs.size;
    }
    return Array.from(this._tabs.values()).filter(tab => tab.pinned === pinned).length;
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

  moveTabToStart(currentTab) {
    const minIndex = Math.min(...this._tabsBefore(currentTab).map(tab => tab.index));
    browser.tabs.move(currentTab.id, { index: minIndex });
  }

  moveTabToEnd(currentTab) {
    const maxIndex = Math.max(...this._tabsAfter(currentTab).map(tab => tab.index));
    browser.tabs.move(currentTab.id, { index: maxIndex });
  }

  _tabsBefore(currentTab) {
    return [...this._tabs.values()].filter(
      tab => tab.index < currentTab.index && tab.pinned === currentTab.pinned && !tab.hidden,
    );
  }

  hasTabsBefore(currentTab) {
    // I use _tabBefore() because some() is faster than filter()
    // because it stops as soon at it founds a match
    return [...this._tabs.values()].some(
      tab => tab.index < currentTab.index && tab.pinned === currentTab.pinned && !tab.hidden,
    );
  }

  closeTabsBeforeCount(currentTab) {
    return this._tabsBefore(currentTab).length;
  }

  closeTabsBefore(currentTab) {
    browser.tabs.remove(this._tabsBefore(currentTab).map(tab => tab.id));
  }

  _tabsAfter(currentTab) {
    return [...this._tabs.values()].filter(
      tab => tab.index > currentTab.index && tab.pinned === currentTab.pinned && !tab.hidden,
    );
  }

  hasTabsAfter(currentTab) {
    return [...this._tabs.values()].some(
      tab => tab.index > currentTab.index && tab.pinned === currentTab.pinned && !tab.hidden,
    );
  }

  closeTabsAfterCount(currentTab) {
    return this._tabsAfter(currentTab).length;
  }

  closeTabsAfter(currentTab) {
    browser.tabs.remove(this._tabsAfter(currentTab).map(tab => tab.id));
  }

  closeAllTabsExceptCount(tabId) {
    return this._allTabsExcept(tabId).length;
  }

  closeAllTabsExcept(tabId) {
    const toClose = this._allTabsExcept(tabId).map(tab => tab.id);
    browser.tabs.remove(toClose);
  }

  _allTabsExcept(tabId) {
    return [...this._tabs.values()].filter(tab => tab.id !== tabId && !tab.pinned && !tab.hidden);
  }

  async undoCloseTab() {
    const undoTabs = await this._getRecentlyClosedTabs();
    if (undoTabs.length !== 0) {
      browser.sessions.restore(undoTabs[0].sessionId);
      this.hasRecentlyClosedTabs = undoTabs.length >= 2;
    }
  }
}

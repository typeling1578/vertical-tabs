import SideTab from "./tab.js";
import ContextMenu from "./contextmenu.js";
import fuzzysort from "./lib/fuzzysort.js";

const COMPACT_MODE_OFF = 0;
/*const COMPACT_MODE_DYNAMIC = 1;*/
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
    this.__tabsShrinked = false;
    this._windowId = props.windowId;
    this._filterActive = false;
    this._isDragging = false;
    this._scrollTimer = null;
    this._openInNewWindowTimer = null;
    this._highlightBottomScrollShadowTimer = null;
    this._view = document.getElementById("tablist");
    this._pinnedview = document.getElementById("pinnedtablist");
    this._wrapperView = document.getElementById("tablist-wrapper");
    this._spacerView = document.getElementById("spacer");
    this._moreTabsView = document.getElementById("moretabs");

    this._compactModeMode = parseInt(this._props.prefs.compactModeMode);
    this._compactPins = this._props.prefs.compactPins;
    this._switchLastActiveTab = this._props.prefs.switchLastActiveTab;

    this._setupListeners();
    this._populate();
    this._updateScrollShadow();

    browser.browserSettings.closeTabsByDoubleClick.get({}).then(({value}) => {
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
      {windowId: this._windowId} // only onUpdated lets us filter by windowId
    );
    browser.tabs.onRemoved.addListener((tabId, removeInfo) =>
      this._onBrowserTabRemoved(tabId, removeInfo.windowId, removeInfo.isWindowClosing));
    browser.tabs.onMoved.addListener(
      (tabId, moveInfo) => this._onBrowserTabMoved(tabId, moveInfo));
    browser.tabs.onAttached.addListener(
      (tabId, attachInfo) => this._onBrowserTabAttached(tabId, attachInfo));
    browser.tabs.onDetached.addListener(
      (tabId, detachInfo) => this._onBrowserTabRemoved(tabId, detachInfo.oldWindowId, false));
    browser.webNavigation.onCompleted.addListener(
      details => this._webNavigationOnCompleted(details));

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
    this._view.addEventListener("scroll", () => this._onScroll());
    document.defaultView.addEventListener("resize", () => this._onScroll());

    // Drag-and-drop.
    document.addEventListener("dragstart", e => this._onDragStart(e));
    document.addEventListener("dragover", e => this._onDragOver(e));
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
    this._maybeShrinkTabs();
  }

  _onBrowserTabCreated(tab) {
    if (!this._checkWindow(tab.windowId)) {
      return;
    }
    this._shiftTabsIndexes(1, tab.index);
    this._create(tab);
  }

  async _onBrowserTabAttached(tabId, {newWindowId, newPosition}) {
    if (!this._checkWindow(newWindowId)) {
      return;
    }
    this._shiftTabsIndexes(1, newPosition);
    const tab = await browser.tabs.get(tabId);
    this._create(tab);
  }

  _onBrowserTabRemoved(tabId, windowId, isWindowClosing) {
    if (!this._checkWindow(windowId) || isWindowClosing) {
      return;
    }
    const sidetab = this.getTabById(tabId);
    this._shiftTabsIndexes(-1, sidetab.index);
    this._remove(sidetab);
    this._updateHasRecentlyClosedTabs();
  }

  _onBrowserTabActivated(activeInfo) {
    if (!this._checkWindow(activeInfo.windowId)) {
      return;
    }
    const sidetab = this.getTabById(activeInfo.tabId);
    if (!sidetab) { // if tab is not moved yet from one window to another
      return;
    }
    this._setActive(sidetab);
    this._maybeUpdateTabThumbnail(sidetab);
    this.scrollIntoView(sidetab);
  }

  _onBrowserTabMoved(tabId, moveInfo) {
    if (!this._checkWindow(moveInfo.windowId)) {
      return;
    }
    const sidetab = this.getTabById(tabId);
    const {fromIndex, toIndex} = moveInfo;
    const direction = fromIndex < toIndex ? -1 : 1;
    const start = direction > 0 ? toIndex : fromIndex + 1;
    const end = direction > 0 ? fromIndex : toIndex + 1;
    this._shiftTabsIndexes(direction, start, end);
    sidetab.index = toIndex;

    if (sidetab.hidden) {
      return;
    }
    this._appendTabView(sidetab);
    this.scrollIntoView(sidetab);
  }

  _onBrowserTabUpdated(tabId, changeInfo, tab) {
    const sidetab = this.getTabById(tabId);
    if (!sidetab) { // if tab hasn’t yet been created in our tablist
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

  _webNavigationOnCompleted({tabId, frameId}) {
    if (frameId !== 0) { // We only care about top-level frames.
      return;
    }
    const sidetab = this.getTabById(tabId);
    if (!sidetab) { // Could be null because different window.
      return;
    }
    sidetab.burst();
  }

  _onMouseDown(e) {
    // Prevent autoscrolling on middle click
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
  }

  _onMouseUp(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (e.button === 0 && SideTab.isTabEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      if (tabId !== this._active) {
        browser.tabs.update(tabId, {active: true});
      } else if (this._switchLastActiveTab && this._tabs.size > 1) {
        browser.tabs.query({currentWindow: true}).then(tabs => {
          tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
          browser.tabs.update(tabs[1].id, {active: true});
        });
      }

      this._props.search("");
      return;
    }
    // Prevent autoscrolling on middle click
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
  }

  _onMouseOver(e) {
    const tabId = SideTab.tabIdForEvent(e);
    if (tabId === this._active) {
      this.scrollIntoView(this.getTabById(tabId));
    }
  }

  _onAuxClick(e) {
    if (e.button === 1 && SideTab.isTabEvent(e, false)) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
      e.preventDefault();
      return;
    }
  }

  _onScroll() {
    if (this._scrollTimer !== null) {
      clearTimeout(this._scrollTimer);
    } else {
      this._updateScrollShadow();
    }
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      this._updateScrollShadow();
    }, 100);
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
  }

  _scrollIntoViewIfNeeded(tab) {
    const {top: parentTop, height} = this._view.getBoundingClientRect();
    const {top, bottom} = tab.view.getBoundingClientRect();
    if ((top - parentTop) < 0 || (bottom - parentTop) > height) {
      // check if scrolling to tab won’t push active tab outside view
      const activeTab = this.getTabById(this._active);
      if (tab.id !== this._active && !activeTab.pinned) {
        const {top: activeTop} = activeTab.view.getBoundingClientRect();
        if (activeTop > parentTop) {
          activeTab.view.scrollIntoView(true);
        }
        this._highlightBottomScrollShadow();
        return;
      }
      tab.view.scrollIntoView({block: "nearest"});
    }
  }

  _highlightBottomScrollShadow() {
    clearTimeout(this._highlightBottomScrollShadowTimer);
    this._wrapperView.classList.add("highlight-scroll-bottom");
    this._highlightBottomScrollShadowTimer = setTimeout(
      () => this._wrapperView.classList.remove("highlight-scroll-bottom"), 500);
  }

  _updateScrollShadow() {
    const {scrollTop, clientHeight, scrollHeight} = this._view;
    this._wrapperView.classList.toggle("can-scroll-top", scrollTop !== 0);
    this._wrapperView.classList.toggle("can-scroll-bottom",
      (scrollTop + clientHeight) < scrollHeight);
  }

  _onClick(e) {
    if (SideTab.isCloseButtonEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (SideTab.isIconOverlayEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      browser.tabs.update(tabId, {"muted": !tab.muted});
    }
  }

  _onDblClick(e) {
    if (SideTab.isTabEvent(e) && this.closeTabsByDoubleClick) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
    }
  }

  _onDragStart(e) {
    this._isDragging = true;
    if (!SideTab.isTabEvent(e) || this._filterActive) {
      return;
    }
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    e.dataTransfer.setData("text/x-tabcenter-tab", JSON.stringify({
      tabId: parseInt(SideTab.tabIdForEvent(e)),
      origWindowId: this._windowId
    }));
    e.dataTransfer.setData("text/x-moz-place", JSON.stringify({
      type: "text/x-moz-place",
      title: tab.title,
      uri: tab.url
    }));
    e.dataTransfer.dropEffect = "move";
  }

  _onDragOver(e) {
    e.preventDefault();
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
    this._isDragging = false;
    clearTimeout(this._openInNewWindowTimer);

    if (!SideTab.isTabEvent(e, false) &&
      e.target !== this._spacerView &&
      e.target !== this._moreTabsView) {
      return;
    }
    e.preventDefault();

    const dt = e.dataTransfer;
    const tabStr = dt.getData("text/x-tabcenter-tab");
    if (tabStr) {
      return this._handleDroppedTabCenterTab(e, JSON.parse(tabStr));
    }
    const mozURL = this._findMozURL(dt);
    if (!mozURL) {
      console.warn("Unknown drag-and-drop operation. Aborting.");
      return;
    }
    this._props.openTab({
      url: mozURL,
      windowId: this._windowId
    });
    return;
  }

  _handleDroppedTabCenterTab(e, tab) {
    const {tabId, origWindowId} = tab;
    if (!this._checkWindow(origWindowId)) {
      browser.tabs.move(tabId, {windowId: this._windowId, index: -1});
      browser.tabs.update(tabId, {active: true});
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

    if (curTab.pinned !== dropTab.pinned) { // They can't mix
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

    const curTabPos = curTab.index;
    const dropTabPos = dropTab.index;
    const newPos = curTabPos < dropTabPos ? Math.min(this._tabs.size, dropTabPos) :
      Math.max(0, dropTabPos);
    browser.tabs.move(tabId, {index: newPos});
  }

  _onDragend(e) {
    this._openInNewWindowTimer = setTimeout(
      () => {
        if (this._isDragging === true) {
          browser.windows.create({tabId: SideTab.tabIdForView(e.target)});
        }
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
    tab.onAnimationEnd(e);
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
    this._updateScrollShadow();
  }

  filter(query) {
    this._filterActive = query.length > 0;

    const tabs = [...this._tabs.values()];
    let notShown = 0;
    if (query.length) {
      const results = fuzzysort.go(query, tabs, {
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
        tab.resetOrder();
        if (show) {
          if (result[0]) { // title
            tab.highlightTitle(fuzzysort.highlight(result[0], "<b>", "</b>"));
          }
          if (result[1]) { // host
            tab.highlightHost(fuzzysort.highlight(result[1], "<b>", "</b>"));
          }
          tab.setOrder(result.order);
        } else {
          notShown += 1;
        }
      }
    } else {
      for (const tab of tabs) {
        tab.updateVisibility(true);
        tab.resetHighlights();
        tab.resetOrder();
      }
    }
    if (notShown > 0) {
      // Sadly browser.i18n doesn't support plurals, which is why we
      // only show a boring "Show all tabs…" message.
      this._moreTabsView.textContent = browser.i18n.getMessage("allTabsLabel");
      this._moreTabsView.setAttribute("hasMoreTabs", true);
    } else {
      this._moreTabsView.removeAttribute("hasMoreTabs");
    }
    this._maybeShrinkTabs();
  }

  async _populate() {
    const tabs = await browser.tabs.query({windowId: this._windowId});
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
  }

  _checkWindow(windowId) {
    return (windowId === this._windowId);
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
      const previousTabsShrinked = this._tabsShrinked;
      this.__maybeShrinkTabs();
      if (this._tabsShrinked !== previousTabsShrinked) {
        this._updateScrollShadow();
      }
    });
  }

  __maybeShrinkTabs() {
    if (this._compactModeMode === COMPACT_MODE_STRICT ||
      this._compactModeMode === COMPACT_MODE_OFF) {
      this._tabsShrinked = this._compactModeMode === COMPACT_MODE_STRICT;
      return;
    }

    const spaceLeft = this._spacerView.offsetHeight;
    if (!this._tabsShrinked && spaceLeft === 0) {
      this._tabsShrinked = true;
      return;
    }
    if (!this._tabsShrinked) {
      return;
    }
    // Could we fit everything if we switched back to the "normal" mode?
    const wrapperHeight = this._wrapperView.offsetHeight;
    const estimatedTabHeight = 56; // Not very scientific, but it "mostly" works.

    // TODO: We are not accounting for the "More Tabs" element displayed when
    // filtering tabs.
    let estimatedHeight = 0;
    let numPinnedTabs = 0;
    for (const tab of this._tabs.values()) {
      if (tab.visible) {
        if (!tab.pinned) {
          estimatedHeight += estimatedTabHeight;
        } else {
          numPinnedTabs++;
        }
      }
    }
    estimatedHeight += this._compactPins && numPinnedTabs > 0 ?
      this._pinnedview.offsetHeight :
      numPinnedTabs * estimatedTabHeight;

    if (estimatedHeight <= wrapperHeight) {
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
    sidetab.view.remove();
    this._tabs.delete(sidetab.id);
    this._maybeShrinkTabs();
  }

  _appendTabView(sidetab) {
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
    if (tabAfter) {
      parent.insertBefore(element, tabAfter.view);
    } else {
      parent.appendChild(element);
    }
  }

  _removeTabView(sidetab) {
    const element = sidetab.view;
    const parent = sidetab.pinned ? this._pinnedview : this._view;
    parent.removeChild(element);
  }

  _onTabPinned(sidetab) {
    if (sidetab.pinned && this._compactPins) {
      sidetab.resetThumbnail();
    }
    this._appendTabView(sidetab);
    this._maybeShrinkTabs();
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

  getFirstTabId() {
    return this._tabs.keys().next().value;
  }

  /*
   * Functions below are used by ContextMenu
   */
  tabCount() {
    return this._tabs.size;
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
      if (session.tab && this._checkWindow(session.tab.windowId)) {
        acc.push(session.tab);
      }
      return acc;
    }, []);
  }

  hasTabsUnderneath(currentTab) {
    return Array.from(this._tabs)
      .map(elem => elem[1])
      .filter(tab => tab.pinned === currentTab.pinned)
      .some(tab => tab.index > currentTab.index);
  }

  moveTabToStart(currentTab) {
    const minIndex = Math.min(...Array.from(this._tabs)
      .map(elem => elem[1])
      .filter(tab => tab.pinned === currentTab.pinned)
      .map(tab => tab.index));
    browser.tabs.move(currentTab.id, {index: minIndex});
  }

  async moveTabToEnd(currentTab) {
    const maxIndex = Math.max(...Array.from(this._tabs)
      .map(elem => elem[1])
      .filter(tab => tab.pinned === currentTab.pinned)
      .map(tab => tab.index));
    browser.tabs.move(currentTab.id, {index: maxIndex});
  }

  closeTabsAfterCount(tabIndex) {
    return [...this._tabs.values()]
      .filter(tab => tab.index > tabIndex && !tab.hidden)
      .length;
  }

  closeTabsAfter(tabIndex) {
    const toClose = [...this._tabs.values()]
      .filter(tab => tab.index > tabIndex && !tab.hidden)
      .map(tab => tab.id);
    browser.tabs.remove(toClose);
  }

  closeAllTabsExceptCount(tabId) {
    return [...this._tabs.values()]
      .filter(tab => tab.id !== tabId && !tab.pinned && !tab.hidden)
      .length;
  }

  closeAllTabsExcept(tabId) {
    const toClose = [...this._tabs.values()]
      .filter(tab => tab.id !== tabId && !tab.pinned && !tab.hidden)
      .map(tab => tab.id);
    browser.tabs.remove(toClose);
  }

  async undoCloseTab() {
    const undoTabs = await this._getRecentlyClosedTabs();
    if (undoTabs.length) {
      browser.sessions.restore(undoTabs[0].sessionId);
    }
    this._updateHasRecentlyClosedTabs();
  }
}

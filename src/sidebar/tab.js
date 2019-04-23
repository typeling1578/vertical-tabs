/* global CSSAnimation */

export default class SideTab {
  constructor() {
    this.id = null;
    this.url = null;
    this.title = null;
    this.muted = null;
    this.pinned = null;
    this.active = false;
    this.discarded = false;
    this.visible = true;
  }

  init(tabInfo) {
    this.id = tabInfo.id;
    this.index = tabInfo.index;
    this._buildViewStructure();

    this.view.id = `tab-${this.id}`;
    this.view.setAttribute("data-tab-id", this.id);

    this.hidden = tabInfo.hidden;
    this._updateTitle(tabInfo.title);
    this._updateURL(tabInfo.url);
    this._updateAudible(tabInfo.audible);
    this._updatedMuted(tabInfo.mutedInfo.muted);
    this._updateIcon(tabInfo.favIconUrl);
    this._updateLoading(tabInfo.status);
    this._updatePinned(tabInfo.pinned);
    this._updateDiscarded(tabInfo.discarded);
    if (tabInfo.cookieStoreId && tabInfo.cookieStoreId.startsWith("firefox-container-")) {
      // This work is done in the background on purpose: making create() async
      // creates all sorts of bugs, because it is called in observers (which
      // cannot be async).
      browser.contextualIdentities.get(tabInfo.cookieStoreId).then(context => {
        if (!context) {
          return;
        }
        this.view.classList.add("hasContext");
        this.view.setAttribute("data-identity-color", context.color);
      });
    }
    this.updateThumbnail = debounce(() => this._updateThumbnail(), 500);
  }

  _buildViewStructure() {
    const template = document.getElementById("tab-template");
    const tab = template.content.children[0].cloneNode(true);
    this.view = tab;
    this._burstView = tab.querySelector(".tab-loading-burst");
    this._contextView = tab.querySelector(".tab-context");
    this._iconOverlayView = tab.querySelector(".tab-icon-overlay");
    this._metaImageView = tab.querySelector(".tab-meta-image");
    this._iconView = tab.querySelector(".tab-icon");
    this._titleView = tab.querySelector(".tab-title");
    this._hostView = tab.querySelector(".tab-host");
    const close = tab.querySelector(".tab-close");
    close.title = browser.i18n.getMessage("closeTabButtonTooltip");
    this.thumbnailCanvas = tab.querySelector("canvas");
    this.thumbnailCanvas.id = `thumbnail-canvas-${this.id}`;
    this.thumbnailCanvasCtx = this.thumbnailCanvas.getContext("2d", {alpha: false});
  }

  onUpdate(changeInfo, tab) {
    if (changeInfo.hasOwnProperty("hidden")) {
      this.hidden = changeInfo.hidden;
    }
    if (changeInfo.hasOwnProperty("title")) {
      this._updateTitle(changeInfo.title);
    }
    // to work around https://bugzilla.mozilla.org/show_bug.cgi?id=1450384
    // if (changeInfo.hasOwnProperty("favIconUrl")) {
    //   this._updateIcon(changeInfo.favIconUrl);
    // }
    this._updateIcon(tab.favIconUrl);
    if (changeInfo.hasOwnProperty("url")) {
      this._updateURL(changeInfo.url);
    }
    if (changeInfo.hasOwnProperty("audible")) {
      this._updateAudible(changeInfo.audible);
    }
    if (changeInfo.hasOwnProperty("mutedInfo")) {
      this._updatedMuted(changeInfo.mutedInfo.muted);
    }
    if (changeInfo.hasOwnProperty("discarded")) {
      this._updateDiscarded(changeInfo.discarded);
    }
    if (changeInfo.hasOwnProperty("status")) {
      this._updateLoading(changeInfo.status);
    }
    if (changeInfo.hasOwnProperty("pinned")) {
      this._updatePinned(changeInfo.pinned);
    }
  }

  get host() {
    return new URL(this.url).host || this.url;
  }

  _updateTitle(title) {
    if (this.title && this.title !== title) {
      if (!this.view.classList.contains("active")) {
        this.view.classList.add("wants-attention");
      }
    }
    this.title = title;
    this._titleView.textContent = title;
    this.view.title = title;
  }

  _updateIcon(favIconUrl) {
    if (favIconUrl) {
      this._setIcon(favIconUrl);
    } else {
      this._resetIcon();
    }
  }

  _updateURL(url) {
    this.url = url;
    this._hostView.innerText = this.host;
  }

  _updateAudible(audible) {
    this._iconOverlayView.classList.toggle("sound", audible);
  }

  _updatedMuted(muted) {
    this.muted = muted;
    this._iconOverlayView.classList.toggle("muted", muted);
  }

  _updateLoading(status) {
    this.view.classList.toggle("loading", status === "loading");
    if (status === "loading") {
      SideTab._syncThrobberAnimations();
      this._notselectedsinceload = !this.view.classList.contains("active");
    } else {
      if (this._notselectedsinceload) {
        this.view.setAttribute("notselectedsinceload", "true");
      } else {
        this.view.removeAttribute("notselectedsinceload");
      }
    }
  }

  burst() {
    this._burstView.classList.add("bursting");
  }

  updateActive(active) {
    this.active = active;
    this.view.classList.toggle("active", active);
    if (active) {
      this._notselectedsinceload = false;
      this.view.removeAttribute("notselectedsinceload");
      this.view.classList.remove("wants-attention");
    }
  }

  scrollIntoView() {
    // Pinned tabs are always into view!
    if (this.pinned) {
      return;
    }
    this._scrollIntoViewIfNeeded();
    // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1139745#c7
    // we still make a first scrollIntoView so that it starts scrolling right away
    setTimeout(() => this._scrollIntoViewIfNeeded(), 100);
  }

  _scrollIntoViewIfNeeded() {
    const {top: parentTop, height} = this.view.parentNode.getBoundingClientRect();
    let {top, bottom} = this.view.getBoundingClientRect();
    if ((top - parentTop) < 0 || (bottom - parentTop) > height) {
      this.view.scrollIntoView({block: "nearest"});
    }
  }

  updateVisibility(show) {
    this.visible = show;
    this.view.classList.toggle("hidden", !show);
  }

  _setIcon(favIconUrl) {
    if (favIconUrl.startsWith("chrome://") && favIconUrl.endsWith(".svg")
        && favIconUrl !== "chrome://browser/skin/privatebrowsing/favicon.svg") {
      this._iconView.classList.add("chrome-icon");
    } else {
      this._iconView.classList.remove("chrome-icon");
    }
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1462948
    if (favIconUrl === "chrome://mozapps/skin/extensions/extensionGeneric-16.svg") {
      favIconUrl = "img/extensions.svg";
    }
    this._iconView.style.backgroundImage = `url("${favIconUrl}")`;
    const imgTest = document.createElement("img");
    imgTest.src = favIconUrl;
    imgTest.onerror = () => {
      this._resetIcon();
    };
  }

  _resetIcon() {
    this._iconView.style.backgroundImage = "url(\"img/defaultFavicon.svg\")";
    this._iconView.classList.add("chrome-icon");
  }

  _updatePinned(pinned) {
    this.pinned = pinned;
    this.view.classList.toggle("pinned", pinned);
  }

  _updateDiscarded(discarded) {
    this.discarded = discarded;
    this.view.classList.toggle("discarded", discarded);
  }

  _updateThumbnail() {
    requestIdleCallback(async () => {

      let thumbnailBase64 = null;
      try {
        thumbnailBase64 = await browser.tabs.captureTab(this.id, {
          format: "png"
        });
      } catch (error) {
        //the tab is not available;
      }

      if (thumbnailBase64) {
        await this._updateThumbnailCanvas(thumbnailBase64);
        this._metaImageView.style.backgroundImage = `-moz-element(#${this.thumbnailCanvas.id})`;
        this._metaImageView.classList.add("has-thumbnail");
      }

    });
  }

  _updateThumbnailCanvas(base64Str) {
    const desiredHeight = 192;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        // Resize the image to lower the memory consumption.
        const width = Math.floor(img.width * desiredHeight / img.height);
        this.thumbnailCanvas.width = width;
        this.thumbnailCanvas.height = desiredHeight;
        this.thumbnailCanvasCtx.drawImage(img, 0, 0, width, desiredHeight);
        resolve();
      };
      img.src = base64Str;
    });
  }

  resetThumbnail() {
    this._metaImageView.style.backgroundImage = "";
    this._metaImageView.classList.remove("has-thumbnail");
  }

  onAnimationEnd(e) {
    if (e.target.classList.contains("tab-loading-burst")) {
      this._burstView.classList.remove("bursting");
    }
  }

  resetHighlights() {
    this._titleView.innerText = this.title;
    this._hostView.innerText = this.host;
  }

  highlightTitle(newTitle) {
    this._titleView.innerHTML = newTitle;
  }

  highlightHost(newHost) {
    this._hostView.innerHTML = newHost;
  }

  resetOrder() {
    this.setOrder(null);
  }

  setOrder(idx) {
    this.view.style.order = idx;
  }

  // If strict is true, this will return false for subviews (e.g the close button).
  static isTabEvent(e, strict = true) {
    let el = e.target;
    if (!el) {
      return false;
    }
    const isTabNode = (node) => node && node.classList.contains("tab");
    if (isTabNode(el)) {
      return true;
    }
    if (strict) {
      return false;
    }
    while ((el = el.parentElement)) {
      if (isTabNode(el)) {
        return true;
      }
    }
    return false;
  }

  static isCloseButtonEvent(e) {
    return e.target && e.target.classList.contains("tab-close");
  }

  static isIconOverlayEvent(e) {
    return e.target && e.target.classList.contains("tab-icon-overlay");
  }

  static tabIdForView(el) {
    if (!el) {
      return null;
    }
    return parseInt(el.getAttribute("data-tab-id"));
  }

  static tabIdForEvent(e) {
    let el = e.target;
    // eslint-disable-next-line curly
    while (!SideTab.tabIdForView(el) && (el = el.parentElement));
    return SideTab.tabIdForView(el);
  }

  static _syncThrobberAnimations() {
    requestAnimationFrame(() => {
      // this API is available only in Dev Edition/Nightly so far
      // https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations
      if (!document.body.getAnimations) {
        return;
      }
      setTimeout(() => {
        const icons = document.querySelectorAll(".tab.loading .tab-icon");
        if (!icons.length) {
          return;
        }
        const animations = [...icons]
          .map(tabIcon => tabIcon.getAnimations({subtree: true}))
          .reduce((a, b) => a.concat(b))
          .filter(anim =>
            anim instanceof CSSAnimation &&
            anim.animationName === "tab-throbber-animation" &&
            (anim.playState === "running" || anim.playState === "pending"));

        // Synchronize with the oldest running animation, if any.
        const firstStartTime = Math.min(
          ...animations.map(anim => anim.startTime === null ? Infinity : anim.startTime)
        );
        if (firstStartTime === Infinity) {
          return;
        }
        requestAnimationFrame(() => {
          for (let animation of animations) {
            // If |animation| has been cancelled since this rAF callback
            // was scheduled we don't want to set its startTime since
            // that would restart it. We check for a cancelled animation
            // by looking for a null currentTime rather than checking
            // the playState, since reading the playState of
            // a CSSAnimation object will flush style.
            if (animation.currentTime !== null) {
              animation.startTime = firstStartTime;
            }
          }
        });
      }, 0);
    });
  }
}

function debounce(fn, delay) {
  let timeoutID;
  return (...args) => {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(() => {
      timeoutID = null;
      fn(...args);
    }, delay);
  };
}

/* global browser, requestAnimationFrame, requestIdleCallback, CSSAnimation, Image */

import { debounced } from "../common";

let TAB_TEMPLATE = null;
// we put URL before favicon URL for one of the workaround in _updateIcon()
const TAB_UPDATE_FIELDS = [
  "attention",
  "audible",
  "discarded",
  "url",
  "favIconUrl",
  "hidden",
  "mutedInfo",
  "status",
  "title",
];

const ABOUT_URLS_WITH_COLORFUL_FAVICON = [
  "about:logins",
  "about:loginsimportreport",
  "about:privatebrowsing",
];

export default class Sidetab {
  constructor(tabInfo) {
    // fields that are taken as is from tabs.Tab
    this.id = tabInfo.id;
    this.index = tabInfo.index;
    this.url = null;
    this.title = null;
    this.favIconUrl = null;
    this.cookieStoreId = tabInfo.cookieStoreId;
    this.muted = null;
    this.pinned = tabInfo.pinned;
    this.active = null;
    this.discarded = null;
    this.hidden = null;

    // what’s displayed in the tab
    this._formattedUrl = null;
    // if filtered because it doesn’t match the filter entered into toolbar field
    this._filtered = false;
    // if has been batch “closed”, waiting to be restored in view or closed for real
    this._willBeDeleted = false;
    // if it’s either hidden, filtered, or willBeDeleted
    this._isVisible = null;
    // if has not been active since last page loading
    this._unread = false;

    this._buildViewStructure();
    this.view.id = `tab-${this.id}`;
    this.view.setAttribute("data-tab-id", this.id);

    if (!tabInfo.hasOwnProperty("favIconUrl")) {
      tabInfo.favIconUrl = null;
    }
    this.update(tabInfo);
    if (
      tabInfo.cookieStoreId &&
      tabInfo.cookieStoreId.startsWith("firefox-container-") &&
      browser.contextualIdentities
    ) {
      browser.contextualIdentities.get(tabInfo.cookieStoreId).then(
        (context) => {
          this.view.setAttribute("data-identity-color", context.color);
        },
        () => {},
      );
    }
    this.updateThumbnail = debounced(() => this._updateThumbnail(), 500);
  }

  _buildViewStructure() {
    const tab = this._get_tab_template().content.children[0].cloneNode(true);
    this.view = tab;
    this._metaImageView = tab.querySelector(".tab-meta-image");
    this._iconView = tab.querySelector(".tab-icon");
    this._titleView = tab.querySelector(".tab-title");
    this._urlView = tab.querySelector(".tab-url");
    this.thumbnailCanvas = tab.querySelector("canvas");
    this.thumbnailCanvas.id = `thumbnail-canvas-${this.id}`;
    this.thumbnailCanvasCtx = this.thumbnailCanvas.getContext("2d", {
      alpha: false,
    });
  }

  _get_tab_template() {
    if (TAB_TEMPLATE !== null) {
      return TAB_TEMPLATE;
    }
    TAB_TEMPLATE = document.getElementById("tab-template");
    TAB_TEMPLATE.content.querySelector(".tab-close").title =
      browser.i18n.getMessage("closeTabButtonTooltip");
    TAB_TEMPLATE.content.querySelector(".tab-icon-overlay-audible").title =
      browser.i18n.getMessage("unmuteTabButtonTooltip");
    TAB_TEMPLATE.content.querySelector(".tab-icon-overlay-muted").title =
      browser.i18n.getMessage("muteTabButtonTooltip");
    return TAB_TEMPLATE;
  }

  update(info) {
    for (const field of TAB_UPDATE_FIELDS) {
      const value = info[field];
      if (value === undefined && field !== "favIconUrl") {
        continue;
      }
      switch (field) {
        case "attention":
          this._updateAttention(value);
          break;
        case "audible":
          this._updateAudible(value);
          break;
        case "discarded":
          this.updateDiscarded(value);
          break;
        case "favIconUrl":
          this._updateIcon(value);
          break;
        case "hidden":
          this._updateHidden(value);
          break;
        case "mutedInfo":
          this._updatedMuted(value);
          break;
        // "pinned" case is handled in tablist.js for practical reasons
        case "status":
          this._updateLoading(value);
          break;
        case "title":
          this._updateTitle(value);
          break;
        case "url":
          this._updateURL(value);
          break;
      }
    }
  }

  _updateTitle(title) {
    if (this.title === title) {
      return;
    }

    if (this.title && !this.active) {
      this.view.classList.add("wants-attention");
    }
    this.title = title;
    this._titleView.textContent = title;
    this.view.title = title;
    this.view.setAttribute("data-title", title);
  }

  static formatUrl(url) {
    return url.replace(/^(http|https):\/\//, "");
  }

  _updateURL(url) {
    this.url = url;
    this.view.setAttribute("data-url", url);
    this._formattedUrl = Sidetab.formatUrl(url);
    this._urlView.innerText = this._formattedUrl;
  }

  _updateAttention(attention) {
    this.view.classList.toggle("wants-attention", attention);
  }

  _updateAudible(audible) {
    this.view.classList.toggle("audible", audible);
  }

  _updatedMuted(mutedInfo) {
    const muted = mutedInfo.muted;
    this.muted = muted;
    this.view.classList.toggle("muted", muted);
  }

  _updateLoading(status) {
    this.view.classList.toggle("loading", status === "loading");
    if (status === "loading") {
      Sidetab._syncThrobberAnimations();
      this._unread = !this.active;
    } else {
      this.view.classList.toggle("unread", this._unread);
    }
  }

  burst() {
    this.view.classList.add("bursting");
  }

  updateActive(active) {
    this.active = active;
    this.view.classList.toggle("active", active);
    if (active) {
      this._unread = false;
      this.view.classList.remove("unread", "wants-attention");
    }
  }

  _updateHidden(hidden) {
    this.hidden = hidden;
    this._updateVisible();
  }

  updateSearchHidden(hidden) {
    this._filtered = hidden;
    this._updateVisible();
  }

  updateWillBeDeletedHidden(hidden) {
    this._willBeDeleted = hidden;
    this._updateVisible();
  }

  _updateVisible() {
    const isVisible = !this.hidden && !this._filtered && !this._willBeDeleted;
    if (isVisible === this._visible) {
      return;
    }
    this._visible = isVisible;
    this.view.classList.toggle("hidden", !isVisible);
  }

  isVisible() {
    return this._visible;
  }

  _updateIcon(favIconUrl) {
    if (!favIconUrl) {
      this._resetIcon();
      return;
    }
    this.favIconUrl = favIconUrl;

    this._iconView.classList.remove("default-favicon");
    this._iconView.classList.toggle(
      "chrome-icon",
      // Color built-in monochrome favicons according to theme like in native tab bar
      this.url.startsWith("about:") &&
        favIconUrl.endsWith(".svg") &&
        // but don’t recolor colorful icons
        !ABOUT_URLS_WITH_COLORFUL_FAVICON.some((url) => this.url.startsWith(url)),
    );

    // Some built-in icons can’t be loaded, so we use our own
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1462948
    if (this.url.startsWith("about:addons")) {
      favIconUrl = "img/extensions.svg";
    } else if (this.url.startsWith("about:profiling")) {
      favIconUrl = "img/profiler-stopwatch.svg";
    }

    this._iconView.style.setProperty("--favicon-url", `url("${favIconUrl}")`);
    const imgTest = document.createElement("img");
    imgTest.onerror = this._resetIcon;
    imgTest.src = favIconUrl;
  }

  _resetIcon() {
    this.favIconUrl = null;
    this._iconView.style.setProperty("--favicon-url", 'url("img/globe.svg")');
    this._iconView.classList.add("chrome-icon", "default-favicon");
  }

  updateDiscarded(discarded) {
    this.discarded = discarded;
    this.view.classList.toggle("discarded", discarded);
  }

  _updateThumbnail() {
    requestIdleCallback(async () => {
      let thumbnailBase64 = null;
      try {
        thumbnailBase64 = await browser.tabs.captureTab(this.id, {
          format: "png",
        });
        await this._updateThumbnailCanvas(thumbnailBase64);
        this._metaImageView.style.backgroundImage = `-moz-element(#${this.thumbnailCanvas.id})`;
        this._metaImageView.classList.add("has-thumbnail");
      } catch (error) {
        // the tab is not available;
      }
    });
  }

  _updateThumbnailCanvas(base64Str) {
    const desiredHeight = 192;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Resize the image to lower the memory consumption.
        const width = Math.floor((img.width * desiredHeight) / img.height);
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
      this.view.classList.remove("bursting");
    }
  }

  resetHighlights() {
    this._titleView.innerText = this.title;
    this._urlView.innerText = Sidetab.formatUrl(this.url);
  }

  highlightTitle(newTitle) {
    this._titleView.innerHTML = newTitle;
  }

  highlightHost(newHost) {
    this._urlView.innerHTML = newHost;
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

  static _tabIdForView(el) {
    if (!el) {
      return null;
    }
    return parseInt(el.getAttribute("data-tab-id"));
  }

  static tabIdForEvent(e) {
    let el = e.target;
    // eslint-disable-next-line curly
    while (!Sidetab._tabIdForView(el) && (el = el.parentElement));
    return Sidetab._tabIdForView(el);
  }

  static _syncThrobberAnimations() {
    // this API is available only in Dev Edition/Nightly so far
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations
    if (!document.body.getAnimations) {
      return;
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        const icons = document.querySelectorAll(".tab.loading .tab-icon");
        if (!icons.length) {
          return;
        }
        const animations = [...icons]
          .map((tabIcon) => tabIcon.getAnimations({ subtree: true }))
          .reduce((a, b) => a.concat(b))
          .filter(
            (anim) =>
              anim instanceof CSSAnimation &&
              anim.animationName === "tab-throbber-animation" &&
              (anim.playState === "running" || anim.playState === "pending"),
          );

        // Synchronize with the oldest running animation, if any.
        const firstStartTime = Math.min(
          ...animations.map((anim) => (anim.startTime === null ? Infinity : anim.startTime)),
        );
        if (firstStartTime === Infinity) {
          return;
        }
        requestAnimationFrame(() => {
          for (const animation of animations) {
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

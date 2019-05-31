/* global browser */

import getContextualIdentityItems from "./contextualidentities.js";

/* @arg {props}
 * openTab
 * search
 */
export default class TopMenu {
  constructor(props) {
    this._props = props;
    this._newTabButtonView = document.getElementById("newtab");
    this._newTabButtonIconView = document.getElementById("newtab-icon");
    this._newTabButtonArrowView = document.getElementById("newtab-arrow");
    this._settingsView = document.getElementById("settings");
    this._searchBoxInput = document.getElementById("searchbox-input");
    this._newTabLabelView = document.getElementById("newtab-label");
    this._setupLabels();
    this._setupListeners();
  }

  updateSearch(val) {
    this._searchBoxInput.value = val;
  }

  _setupListeners() {
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });
    this._searchBoxInput.addEventListener("input", e => {
      this._props.search(e.target.value);
    });
    this._newTabButtonView.addEventListener("click", () => {
      this._props.openTab();
    });
    this._newTabButtonView.addEventListener("auxclick", e => {
      if (e.button === 1) {
        this._props.openTab({ afterCurrent: true });
      }
    });
    this._newTabButtonView.addEventListener("contextmenu", e => {
      this._showNewTabPopup(e);
    });

    window.addEventListener("keyup", e => {
      if (e.key === "Escape") {
        this._props.search("");
      }
    });

    browser.menus.onClicked.addListener(info => {
      if (info.menuItemId.startsWith("contextMenuOpenInNewContextualTab_")) {
        this._props.openTab({
          afterCurrent: true,
          cookieStoreId: info.menuItemId.split("contextMenuOpenInNewContextualTab_")[1],
        });
      }
    });
  }

  _setupLabels() {
    this._newTabButtonView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
  }

  _showNewTabPopup(e) {
    browser.menus.removeAll();
    if (document.body.classList.contains("incognito")) {
      e.preventDefault();
      return;
    }
    const identityItems = getContextualIdentityItems();
    if (identityItems !== null) {
      identityItems.forEach(identityItem => {
        identityItem["id"] = `contextMenuOpenInNewContextualTab_${identityItem["id"]}`;
        browser.menus.create(identityItem);
      });
    }

    browser.menus.overrideContext({});
  }
}

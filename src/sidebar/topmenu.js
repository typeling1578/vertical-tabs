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

  async _setupListeners() {
    const newTabPosition = (await browser.browserSettings.newTabPosition.get({})).value;
    const otherTabPosition = newTabPosition === "afterCurrent" ? "atEnd" : "afterCurrent";

    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

    this._searchBoxInput.addEventListener("input", e => {
      this._props.search(e.target.value);
    });

    this._newTabButtonView.addEventListener("click", e => {
      if (e.ctrlKey === true && e.shiftKey === true) {
        browser.windows.create({ incognito: true });
      } else if (e.ctrlKey === true) {
        this._props.openTab({ _position: otherTabPosition });
      } else if (e.shiftKey === true) {
        browser.windows.create();
      } else {
        this._props.openTab(props);
      }
    });

    this._newTabButtonView.addEventListener("auxclick", e => {
      if (e.button === 1) {
        this._props.openTab({ _position: otherTabPosition });
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

    browser.menus.onClicked.addListener((info, tab) => {
      if (!info.menuItemId.startsWith("contextMenuOpenInNewContextualTab_")) {
        return;
      }
      const props = { cookieStoreId: info.menuItemId.split("contextMenuOpenInNewContextualTab_")[1] };
      if (info.modifiers.includes("Ctrl")) {
        props["_position"] = otherTabPosition;
        this._props.openTab(props);
      } else if (info.modifiers.includes("Shift")) {
        browser.windows.create(props);
      } else {
        this._props.openTab(props);
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

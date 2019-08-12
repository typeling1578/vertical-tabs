/* global browser */

import { openTab } from "./utils.js";
import getContextualIdentityItems from "./contextualidentities.js";

/* @arg {props}
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
    browser.extension
      .isAllowedIncognitoAccess()
      .then(isAllowed => (this._isIncognitoAccessAllowed = isAllowed));
    browser.browserSettings.newTabPosition.get({}).then(setting => {
      this._newTabPosition = setting.value;
      this._alternateNewTabPosition = setting.value === "afterCurrent" ? "atEnd" : "afterCurrent";
    });

    this._setupLabels();
    this._setupListeners();
  }

  updateSearch(val) {
    this._searchBoxInput.value = val;
  }

  async _setupListeners() {
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

    this._searchBoxInput.addEventListener("input", e => {
      this._props.search(e.target.value);
    });

    this._newTabButtonView.addEventListener("click", e => {
      if (e.ctrlKey === true && e.shiftKey === true) {
        if (this._isIncognitoAccessAllowed) {
          browser.windows.create({ incognito: true });
        }
      } else if (e.ctrlKey === true) {
        openTab({ _position: this._alternateNewTabPosition });
      } else if (e.shiftKey === true) {
        browser.windows.create();
      } else {
        openTab({ _position: this._newTabPosition });
      }
    });

    this._newTabButtonView.addEventListener("auxclick", async e => {
      if (e.button === 1) {
        openTab({ _position: this._alternateNewTabPosition });
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

    browser.menus.onClicked.addListener(info => this._onNewTabContextMenuClicked(info));
  }

  async _onNewTabContextMenuClicked(info) {
    if (!info.menuItemId.startsWith("newTabContextMenu")) {
      return;
    }

    const currentWindow = await browser.windows.getCurrent();
    const lastFocusedWindow = await browser.windows.getLastFocused();
    if (currentWindow.id !== lastFocusedWindow.id) {
      return;
    }

    switch (info.menuItemId) {
      case "newTabContextMenuOpenAlternatePosition":
        openTab({ _position: this._alternateNewTabPosition });
        return;
      case "newTabContextMenuOpenInWindow":
        browser.windows.create();
        return;
      case "newTabContextMenuOpenInPrivateWindow":
        browser.windows.create({ incognito: true });
        return;
    }

    if (!info.menuItemId.startsWith("newTabContextMenuOpenInNewContextualTab_")) {
      return;
    }

    const props = {
      cookieStoreId: info.menuItemId.split("newTabContextMenuOpenInNewContextualTab_")[1],
    };
    if (info.modifiers.includes("Ctrl")) {
      props["_position"] = this._alternateNewTabPosition;
      openTab(props);
    } else if (info.modifiers.includes("Shift")) {
      browser.windows.create(props);
    } else {
      openTab(props);
    }
  }

  async _setupLabels() {
    this._newTabButtonView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
  }

  async _showNewTabPopup(e) {
    browser.menus.removeAll();

    const items = [
      {
        id: "newTabContextMenuOpenAlternatePosition",
        title:
          this._alternateNewTabPosition === "atEnd"
            ? browser.i18n.getMessage("newTabContextMenuOpenAtEnd")
            : browser.i18n.getMessage("newTabContextMenuOpneAfterCurrent"),
      },
      {
        type: "separator",
      },
      {
        id: "newTabContextMenuOpenInWindow",
        title: browser.i18n.getMessage("newTabContextMenuOpenInWindow"),
        icons: {
          "16": `/sidebar/img/new-window.svg`,
          "32": `/sidebar/img/private-browsing.svg`,
        },
      },
      {
        id: "newTabContextMenuOpenInPrivateWindow",
        title: browser.i18n.getMessage("newTabContextMenuOpenInPrivateWindow"),
        icons: {
          "16": `/sidebar/img/private-browsing.svg`,
          "32": `/sidebar/img/private-browsing.svg`,
        },
        enabled: this._isIncognitoAccessAllowed,
      },
      {
        type: "separator",
      },
    ];

    if (!document.body.classList.contains("incognito")) {
      const identityItems = getContextualIdentityItems();
      if (identityItems !== null) {
        identityItems.forEach(identityItem => {
          identityItem["id"] = `newTabContextMenuOpenInNewContextualTab_${identityItem["id"]}`;
          items.push(identityItem);
        });
      }
    }

    for (const item of items) {
      browser.menus.create(item);
    }
    browser.menus.overrideContext({});
  }
}

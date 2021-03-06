/* global browser */

export default class Topmenu {
  constructor(sidebar) {
    this._sidebar = sidebar;
    this._newTabButtonView = document.getElementById("newtab");
    this._newTabButtonIconView = document.getElementById("newtab-icon");
    this._newTabButtonArrowView = document.getElementById("newtab-arrow");
    this._settingsView = document.getElementById("settings");
    this._filterboxInput = document.getElementById("filterbox-input");
    this._newTabLabelView = document.getElementById("newtab-label");
    this._setupLabels();

    browser.extension
      .isAllowedIncognitoAccess()
      .then((isAllowed) => (this._isIncognitoAccessAllowed = isAllowed));

    this._setupListeners();
  }

  updateSearch(val) {
    this._filterboxInput.value = val;
  }

  async _setupListeners() {
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

    this._filterboxInput.addEventListener("input", (e) => {
      this._sidebar.filter(e.target.value);
    });

    this._newTabButtonView.addEventListener("click", (e) => {
      if (e.ctrlKey === true && e.shiftKey === true) {
        if (this._isIncognitoAccessAllowed) {
          browser.windows.create({ incognito: true });
        }
      } else if (e.ctrlKey === true) {
        this._sidebar.createTab({}, { position: this._alternateNewTabPosition });
      } else if (e.shiftKey === true) {
        browser.windows.create();
      } else {
        this._sidebar.createTab({}, { position: this._newTabPosition });
      }
    });

    this._newTabButtonView.addEventListener("auxclick", async (e) => {
      if (e.button === 1) {
        this._sidebar.createTab({ _position: this._alternateNewTabPosition });
      }
    });

    this._newTabButtonView.addEventListener("contextmenu", (e) => {
      this._showNewTabPopup(e);
    });

    browser.browserSettings.newTabPosition
      .get({})
      .then((setting) => this._setNewTabPosition(setting));
    if (browser.browserSettings.newTabPosition.onChange !== undefined) {
      browser.browserSettings.newTabPosition.onChange.addListener((setting) =>
        this._setNewTabPosition(setting),
      );
    }

    window.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        this._sidebar.filter("");
      }
    });

    browser.menus.onClicked.addListener((info) => this._onNewTabContextMenuClicked(info));
  }

  async _onNewTabContextMenuClicked(info) {
    if (!info.menuItemId.startsWith("newTabContextMenu")) {
      return;
    }

    const lastFocusedWindow = await browser.windows.getLastFocused();
    if (this._sidebar.windowId !== lastFocusedWindow.id) {
      return;
    }

    switch (info.menuItemId) {
      case "newTabContextMenuOpenAlternatePosition":
        this._sidebar.createTab(
          {},
          { successorTab: true, position: this._alternateNewTabPosition },
        );
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
      this._sidebar.createTab(props, {
        successorTab: true,
        _position: this._alternateNewTabPosition,
      });
    } else if (info.modifiers.includes("Shift")) {
      browser.windows.create(props);
    } else {
      this._sidebar.createTab(props, { successorTab: true });
    }
  }

  _setNewTabPosition(setting) {
    this._newTabPosition = setting.value;
    this._alternateNewTabPosition = setting.value === "afterCurrent" ? "atEnd" : "afterCurrent";
  }

  async _setupLabels() {
    this._newTabButtonView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._filterboxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
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
      },
      {
        id: "newTabContextMenuOpenInPrivateWindow",
        title: browser.i18n.getMessage("newTabContextMenuOpenInPrivateWindow"),
        enabled: this._isIncognitoAccessAllowed,
      },
    ];

    if (!this._sidebar.incognito) {
      const identityItems = this._sidebar.getContextualIdentityItems();
      if (identityItems.length !== 0) {
        items.push({
          type: "separator",
        });
        for (const identityItem of identityItems) {
          items.push({
            ...identityItem,
            id: `newTabContextMenuOpenInNewContextualTab_${identityItem["id"]}`,
          });
        }
      }
    }

    for (const item of items) {
      browser.menus.create({
        ...item,
        viewTypes: ["sidebar"],
        documentUrlPatterns: [`moz-extension://${location.host}/*`],
      });
    }
    browser.menus.overrideContext({});
  }
}

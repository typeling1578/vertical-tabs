import getContextualIdentityItems from "./contextualidentities.js";

/* @arg {props}
 * openTab
 * search
 */
export default class TopMenu {
  constructor(props) {
    this._props = props;
    this._newTabButtonView = document.getElementById("newtab");
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

    const searchbox = document.getElementById("searchbox");
    this._searchBoxInput.addEventListener("input", (e) => {
      this._props.search(e.target.value);
    });
    this._searchBoxInput.addEventListener("focus", () => {
      searchbox.classList.add("focused");
      this._newTabLabelView.classList.add("hidden");
    });
    this._searchBoxInput.addEventListener("blur", () => {
      searchbox.classList.remove("focused");
      this._newTabLabelView.classList.remove("hidden");
    });

    this._newTabButtonView.addEventListener("click", () => {
      if (!this._newTabPopup) {
        this._props.openTab();
      }
    });
    this._newTabButtonView.addEventListener("auxclick", e => {
      if (e.button === 1) {
        this._props.openTab({afterCurrent: true});
      }
    });
    this._newTabButtonView.addEventListener("contextmenu", () => {
      this._showNewTabPopup();
    });

    window.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        this._props.search("");
      }
    });

    browser.menus.onClicked.addListener((info) => {
      if (info.menuItemId.startsWith("contextMenuOpenInNewContextualTab_")) {
        this._props.openTab({
          afterCurrent: true,
          cookieStoreId: info.menuItemId.split("contextMenuOpenInNewContextualTab_")[1]
        });
      }
    });
  }

  _setupLabels() {
    this._newTabLabelView.textContent = browser.i18n.getMessage("newTabBtnLabel");
    this._newTabLabelView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
  }

  _showNewTabPopup() {
    browser.menus.removeAll();
    let identityItems = getContextualIdentityItems();
    if (identityItems !== null) {
      identityItems.forEach(identityItem => {
        identityItem["id"] = `contextMenuOpenInNewContextualTab_${identityItem["id"]}`;
        browser.menus.create(identityItem);
      });
    }

    browser.menus.overrideContext({
      context: "tab",
      tabId: this._props.getFirstTabId()
    });
  }
}

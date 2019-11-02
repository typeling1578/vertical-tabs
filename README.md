# Tab Center Reborn (alias TCRn)

Simple and powerful vertical tab bar extension for Firefox, continuation of [Tab Center Redux](https://github.com/eoger/tabcenter-redux).

See [the wiki](https://framagit.org/ariasuni/tabcenter-reborn/wikis/home) for advanced customization, using CSS to change the appearance of the extension or tweaking Firefox’s appearance.

[![Install the extension](https://addons.cdn.mozilla.net/static/img/addons-buttons/AMO-button_2.png)](https://addons.mozilla.org/firefox/addon/tabcenter-reborn/)

## Supporting

There are several ways to support this extension:

- Tell your friends, relatives and followers;
- [Rate the extension and add a review on addons.mozilla.org](https://addons.mozilla.org/firefox/addon/tabcenter-reborn/);
- Make a [one-time](https://www.buymeacoffee.com/IRz4hvpVf) or [recurrent donation](https://liberapay.com/ariasuni/) to the main developer.

## Contributing

See [Contributing](https://framagit.org/ariasuni/tabcenter-reborn/blob/main/CONTRIBUTING.md) for instructions on the different ways to contribute.

All contributors are expected to follow the [code of conduct](https://www.contributor-covenant.org/version/1/4/code-of-conduct). Contact: `gen@hack-libre.org`.

## Improvements over Tab Center Redux

- Better documentation for users, contributors and translators
- Improved visual style
  - Follow more closely Firefox’s colors (Photon)
  - Integrate better with custom themes
  - Animate opening and closing of tabs (can be disabled)
  - Adds a bottom shadow in tab list when it’s possible to scroll down
- Use native context menus and use same items as Firefox’s default menus
- Search with default engine when dropping text onto sidebar
- Notify and allows to undo when closing many tabs, instead of asking
- Add entries to new tab context menu (right-click menu)
- Settings synchronized with Firefox Sync

And lots of others fixes and improvements!

## History

In the era of [Test Pilot](https://testpilot.firefox.com/), one of the experiment was [TabCenter](https://github.com/bwinton/TabCenter), a pre-WebExtensions experiment of a vertical tab extension developed my Mozilla. In the end, Mozilla decided that the vertical tabs feature should be left to WebExtensions developer to implement. [Tree Style Tab](https://addons.mozilla.org/fr/firefox/addon/tree-style-tab/), for example, migrated to the WebExtensions API.

In the meantime, [Tab Center Redux](https://github.com/eoger/tabcenter-redux) was started as a way to bring the initial concept of TabCenter (simple, no tree, cleanly integrated) back to users. However, the development stopped because of the developer being busy with other things. After 6 months, I decided to fork the project I had contributed to, to bring the project back to life, hence the name.

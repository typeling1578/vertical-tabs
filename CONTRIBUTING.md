## Translate

Choose your language and start translating and reviewing [here](https://translate.funkwhale.audio/projects/tabcenter-reborn/interface/).

You can take your inspiration from the extension’s already translated strings or the [Firefox translations](https://pontoon.mozilla.org/projects/firefox/).

Can’t find your own language? [Open an issue!](https://framagit.org/ariasuni/tabcenter-reborn/issues)

[![Translation status](https://translate.funkwhale.audio/widgets/tabcenter-reborn/-/interface/svg-badge.svg)](https://translate.funkwhale.audio/engage/tabcenter-reborn/?utm_source=widget)

## Develop

You need to have a recent version of Node.js.

1. Clone this repository
2. Install the dependencies with `npm i`.
3. Run `npm run dev` and start hacking! [Here is a list of some things](https://github.com/eoger/tabcenter-redux/issues?q=is%3Aopen+is%3Aissue+label%3AA-P2) you could work on.

   If you don’t have Firefox Release installed, `WEB_EXT_FIREFOX=nightly npm run dev` or `WEB_EXT_FIREFOX=beta npm run dev` should work much better.

4. Test your changes. Basic functional tests can be run by opening the extension’s debug console (in `about:debugging`), [selecting `/sidebar/tabcenter.html`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Debugging#Debugging_sidebars) and executing `tabCenter.startTests()`.
5. Make sure your changes respect the project’s coding conventions by running `npm run-script lint`.

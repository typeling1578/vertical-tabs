# Technical choices

Here are the choices that were made during the development of Tab Center Reborn.

## Duplicating tabs

`browser.tabs.duplicate()` is [limited](https://bugzilla.mozilla.org/show_bug.cgi?id=1560218)
(and [buggy on Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=1560218)), so we prefer to
recreate the feature with `browser.tabs.create()` instead.

## Extension icon

To set extension icon with a color that respects the user theme (and so is always visible), we use
an hardcoded `data:image/svg+xml,…` string which we modify slightly to use the correct color.

See `setBrowserActionColor()` in [tabcenter.js](src/sidebar/tabcenter.js).

## Notifications

[We can’t create notifications with buttons on Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions#Browser_compatibility),
so the action is triggered when clicking on the notification.

## Smooth scrolling

[Native smooth scrolling is slightly buggy on Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=1139745)
so we use the smooth scrolling implemented in `smooth-scroll-into-view-if-needed` instead.

## Tests

There is no automated tests right now, because [webextensions-jsdom](https://www.npmjs.com/package/webextensions-jsdom), which seemed the only and best way to test correctly the whole extension, didn’t work. Also, it uses [sinon-chrome](https://www.npmjs.com/package/sinon-chrome), which does not support [`browser.menus`](https://beta.developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus).

Also, it’s not possible to access the sidebar with solutions such as Selenium, because one can only interact with the content of the webpage.

## Themes

Firefox themes often puts a color lighter for the active tab than the rest of the tab bar. However, when the colors are light, the contrary works better. So we swap the color of the background of the tablist with the tab bar background color.

Lots of theme only have a background image and a color, and using them result very often in Tab Center Reborn being illisible. If a theme has a background image and doesn’t change the color of the sidebar, then Tab Center Reborn won’t try to use it.

See `_applyTheme()` in [tabcenter.js](src/sidebar/tabcenter.js).

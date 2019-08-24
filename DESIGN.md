# Design

## Principles

### Simple and powerful

Tab Center Reborn aims to be easy-to-use while giving lots of options for power-users. We prefer:

- Letting people write custom CSS instead of adding lots of options
- Putting keyboard shortcuts and actions in menus instead of lots of buttons
- Let people change Firefox behavior and appearance and make Tab Center Reborn follow them

We try to provide a lot of features, even if that’s not used by most people. However, managing and
displaying tabs is already quite complicated; we don’t want to add a lot of code for a minor
enhancement or to handle a very specific use case.

### Respect Firefox defaults when it makes sense

Tab Center Reborn aims to feel as native and intuitive as possible. To achieve this, we chose to
follow Firefox design decisions, except if it doesn’t fit the goal of managing a lot of tabs.

This is why there is an “Unload tab” feature, or why closing a lot of tabs triggers a notification
to undo the closing.

### Do one thing well; be compatible

Tab Center Reborn is simply a vertical tabs extension; but it tries as much as possible to use standards
and take all cases into account to work well with other add-ons.

## Non-goals

## Supports other browsers

Tab Center Reborn is only available on Firefox. The ability to provide a custom sidebar content [is only available on Firefox and Opera](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/sidebar_action#Browser_compatibility). We use a few
features exclusive to Firefox and Opera is a closed source web browser I don’t use or have interest in.

If you’d like to port it, [`contextualIdentities`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities)
(to let the user use Contextual Identities) and [`theme`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/theme) (used
to integrate with current theme) could be easily ignored or removed, but there is no Opera equivalent for [`menus.overrideContext()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/overrideContext) (to display native context menus).

### Tab grouping

Tab grouping should work flawlessly with tab grouping add-ons, so there is no need to implement it directly in Tab Center Reborn. Use something like [Panorama Tab Groups](https://addons.mozilla.org/firefox/addon/panorama-tab-groups/) or [Simple Tab Groups](https://addons.mozilla.org/firefox/addon/simple-tab-groups/) instead.

### Tab Tree

Tab Center Reborn aims to stay simple. If you absolutely want tree tabs, use [Tree Style Tab](https://addons.mozilla.org/firefox/addon/tree-style-tab/) which is Free Software, has lots of options, can be customized with CSS and extended with other extensions.

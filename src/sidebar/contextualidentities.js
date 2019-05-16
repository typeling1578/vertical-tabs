/* global browser, location */

let identities = null;

export default function getContextualIdentityItems() {
  if (identities === null) {
    return null;
  }
  return identities.map(identity => {
    return {
      id: identity.cookieStoreId,
      title: identity.name,
      icons: {
        "16": `/sidebar/img/contextual-identities/${identity.icon}.svg#${identity.color}`,
      },
      viewTypes: ["sidebar"],
      documentUrlPatterns: [`moz-extension://${location.host}/*`],
    };
  });
}

async function updateContextualIdentities() {
  if (browser.contextualIdentities === undefined) {
    identities = null;
  } else {
    identities = await browser.contextualIdentities.query({});
  }
}

updateContextualIdentities();
browser.contextualIdentities.onCreated.addListener(updateContextualIdentities);
browser.contextualIdentities.onRemoved.addListener(updateContextualIdentities);
browser.contextualIdentities.onUpdated.addListener(updateContextualIdentities);

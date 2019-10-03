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
      icons: { "16": `/sidebar/img/identities/${identity.icon}.svg#${identity.color}` },
    };
  });
}

async function updateContextualIdentities() {
  identities = await browser.contextualIdentities.query({});
}

if (browser.contextualIdentities === undefined) {
  identities = null;
} else {
  updateContextualIdentities();
  browser.contextualIdentities.onCreated.addListener(updateContextualIdentities);
  browser.contextualIdentities.onRemoved.addListener(updateContextualIdentities);
  browser.contextualIdentities.onUpdated.addListener(updateContextualIdentities);
}

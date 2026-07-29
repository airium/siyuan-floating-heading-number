# Changelog

## v0.4.0 - 2026-07-29

* Support SiYuan's mobile and browser-mobile frontends.
* Fall back to the matching inside position when an outside placement lacks sufficient gutter space.
* Restrict outside hover suppression to hover-capable fine pointers so touch interaction cannot leave numbers hidden.

## v0.3.3 - 2026-07-27

* Clarify the full-document numbering, non-invasive copy behavior, and display-space settings in English and Simplified Chinese.
* Update the Marketplace preview with a current in-app screenshot and remove outdated demonstration assets.

## v0.3.2 - 2026-07-26

* Keep heading numbers visible during block, range, and highlight selection without adding them to copied content.
* Preserve SiYuan's native heading selection and drag overlays by rendering numbers on editable-child pseudo-elements.

## v0.3.1 - 2026-07-22

* Use inside-left as the default heading-number placement.
* Add a concise feature overview above the README demonstrations.

## v0.3.0 - 2026-07-22

* Add configurable text before and after heading numbers.
* Use the section sign (`§`) as the default prefix and an empty default suffix.

## v0.2.0 - 2026-07-22

* Add five configurable heading-number placements.
* Add a configurable minimum gutter width for outside placements.
* Keep inside and after-text numbers visible during heading hover and gutter activation.
* Keep the minimum gutter width field editable for every placement.

## v0.1.1 - 2026-07-22

* Exclude headings nested in lists from numbering and rendering.

## v0.1.0 - 2026-07-16

* Add exact full-document hierarchical heading numbers floating beside headings in desktop editors.
* Exclude headings nested in blockquotes, callouts, and query embeds.
* Refresh shared document snapshots after heading-affecting transactions.
* Add responsive gutter rendering without mutating block DOM.
* Add global enablement settings in English and Simplified Chinese.
* Remove persisted settings when the plugin is uninstalled.

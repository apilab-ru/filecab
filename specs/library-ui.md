# Library and catalog UI

## Purpose

This document defines the shared library and catalog screens on the website and the
extension full page. [Functionality](functionality.md) owns the product requirement IDs.
[Catalog](catalog-spec.md) owns the server contract.

## Catalog search

- Read provider capabilities before a search.
- Permit a blank query only when the provider sets `browse` to true.
- Show only the filters and orders of the selected operation.
- Wait 300 ms after a query change.
- Cancel the previous request when any search input changes. Ignore its result.
- Reset the page when category, locale, provider, query, filter or order changes.
- Use `hasMore` for Next. Show Last only with an exact total.
- Keep website search options in the route query. Do not put private notes or page URLs in it.
- Use the deployment default provider. Do not show provider, release season, MyAnimeList ID or provider rating controls.
- Do not send removed filter values from saved route parameters.
- Show Release year and Format as compact library-style filters with placeholders, not labels. Use the shared select for Format.
- Show manual entry creation only in library mode.
- The rules of this section apply to full-page and website catalog search. [Popup search](#popup-search) has its own interface.

## Popup layout

Use the [popup mockup](mockup-popup.png).

- The header shows the brand, a Page and Search switch, the full-page link and Settings.
- Page and Search show category tabs with Anime, Films and TV series, then one title field, then popup cards.
- A popup card shows the poster, the title, the year and, for a saved entry, a status menu, the personal rating, episode progress with − and + buttons and a progress bar.
- A status choice, a rating, −, + and a click on the progress bar save at once with the current entry version. A typed progress value saves on Enter or when the field loses focus. A negative or noninteger value is rejected and the saved value returns. A failed save shows an error on the card.
- A card for an unsaved catalog result has no personal controls. Its Add title button opens the editor.
- The title and the poster open the editor. On the Page tab, they link the page to a saved entry that does not hold the page URL. The save removes the link from the entry that held it. See [EDIT-04](functionality.md#5-catalog-search-editing-and-saving). A search-only page has no link, so its cards open the editor.
- On the Page tab, a link mark shows the entry that holds the page URL. The mark has no action.
- Page and Search share the title text and the category. The route keeps them in the path and in the `q` parameter. The Page tab fills the title from the page only when the text is empty.
- The Page tab always searches the catalog by the title text. The entry that holds the page URL comes first, then matching library entries, then catalog results. Each title appears once. The empty result message is hidden when a card is shown.
- Add manual entry is at the bottom of the Page tab.

## Progress control

The popup cards, the library and catalog cards and the editor use one progress control.

- It shows −, a number field, the episode total and +, then a progress bar.
- A click on the bar sets the progress to the episode at the click position, rounded to a whole episode. Without a known total, the bar has no action.
- The number field accepts digits only. A blank or invalid value returns the current value.
- On a card, each change saves at once with the current entry version. In the editor, each change updates the draft, and Save persists it.
- A list row shows only the number field and the total.

## Popup search

The popup Search tab uses the same catalog search contract, debounce and cancellation as the full page.

- Do not show other filters, provider controls or ordering.
- Show popup cards. Do not use the full-page grid or list layout.
- Show Previous and Next. Enable Next only when `hasMore` is true.
- Show loading, empty, offline and error states separately.
- Add title on a result opens the popup editor. See [SEARCH-03](functionality.md#5-catalog-search-editing-and-saving).
- A search save has no viewing link.

## Matching results to the library

- Keep the complete owner library separate from catalog results.
- Match a result by internal identity or a verified reference.
- Show personal fields only from the matched entry.
- A title match is a suggestion. It needs user confirmation.
- A category conflict or a contradictory identity stops the operation.

## Add and rating

Add title saves the result directly:

- status `planned`, personal rating 0 and progress 0;
- title from the requested locale;
- no editor.

Keep the result in place. After the save, hide Add and show the saved state and a personal
rating control. Prevent duplicate submissions. A failed write shows an error and permits a retry.
Edit opens the saved entry. Manual creation does not need a provider response.

## Association and merge

- Catalog association uses the entry version. It keeps the entry UUID, added date and user fields.
- If a second entry has the catalog identity, show both entries and the chosen user fields before the merge.
- The manual entry survives. It keeps the link of the entry with the latest modified time. If that entry has no link, it keeps the link of the other entry. The preview shows the kept link.
- Confirm the preview before apply. Check both versions again before apply.
- On the website, association and merge use one server transaction.
- In the extension, a local merge uses a durable journal. Complete journal recovery before reads, writes or replication.
- If a newer row conflicts with recovery, stop. Keep the journal for raw recovery export.
- A failed preview or a stale version keeps the draft. It does not release a source claim.

## Toolbar and views

- Library and catalog use one configurable filter toolbar.
- Put one view switch at the right end of the category bar. It applies to the active page.
- Offer card and list views. Keep the selected view when the query or page changes.
- Use one result collection component and one result component for both views.

## Cards

Library entries and catalog results use the same card component. Follow the
[dark mockup](mockup-dark.png):

- Put the poster above the title and year. Hide an unknown year.
- Show the saved status and the action menu over the poster.
- Show personal progress and rating below. Show personal values only for saved entries.
- Put Add at the bottom of an unsaved catalog card. Keep Edit and association in the poster menu.
- Use the same poster height, text sizes, status badge, rating row and progress track in both modes.

For unsaved results, show an approximate provider rating on a 10-point scale:

1. Convert each positive score with a valid scale to the 10-point scale.
2. Calculate the arithmetic mean.
3. Round to one decimal place and mark the value as approximate.

If no score is available, show Unrated. Never save a provider score as a personal rating.

### Genres and details

- Show genre icons in a row at the bottom of the poster. Use the genre icon font. Show an icon only for a genre key that has a glyph.
- Give each icon the localized genre name as its accessible name and tooltip.
- In library mode, a click on a genre applies the genre filter.
- Put a Details button at the bottom right of the poster. It opens an overlay on the poster. The card size does not change.
- The overlay shows the description. If there is no description, it shows the comment, marked as a personal note. If there is no comment, it shows a localized empty text.
- The overlay also shows all genre names and the viewing link. Open a link in a new tab with `noopener noreferrer`. Show a link only for HTTP and HTTPS.
- List mode does not show genre icons or the Details button.

### Grid dimensions

Use the light grid mockup as the size reference.

| Item            | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Desktop columns | Four, with equal gaps                                 |
| Card            | 326 × approximately 327 CSS px; column maximum 326 px |
| Gap             | 20 px                                                 |
| Cover           | 25:16 landscape ratio; crop the image to fill         |
| Card body       | 118 px                                                |
| List thumbnail  | 40 × 40 px                                            |

Library and catalog cards use the same sizes, also for unsaved results with Add.
On small screens, covers scale with the card width. Do not stretch narrow covers to a
fixed height. Error text can increase the card height. List mode uses one column.

### List rows

Use the [light list mockup](mockup-light-list.png). A compact row shows a small poster,
title, year, saved status, episode progress, rating and actions. Align rows with a sticky
column header. Permit horizontal scrolling on small screens. Keep Add and the personal
rating control in list mode. Grid mode does not change.

## Ordering

Library column headers sort the complete filtered library before pagination.

- A header click selects its field and toggles its direction.
- Header, Sort by and Order controls use the same order value.
- An order change resets the page.

In catalog mode:

- Enable a header only for orders that the current provider and operation advertise.
- Show arrows only for supported directions. A header without support has no sort action.
- Send the order to the server. Never sort one result page locally.
- Show Sort by and Order as separate controls.
- Offer the provider default order and supported fields only. Label the default Default in English and По умолчанию in Russian.
- Offer only supported directions for the selected field. When the field changes, keep the direction if it is supported. Otherwise select the first supported direction.

## Personal rating picker

Use the rating popup from the light card mockup for saved cards and list rows.

- Open it from the star and the current score.
- Show Your rating, Clear and scores 1 to 10 in two rows of five buttons.
- Highlight the saved score. Mark the active grid card with an accent outline.
- A selected score saves immediately with the current entry version. Clear saves 0.
- After a successful save, close the popup and return focus to the trigger.
- After a failed save, keep the popup open with an error.
- Escape and an outside click close the popup without a write.

Library mode and saved catalog results use the same picker. Provider scores are display only.

## Pagination and loading

Use the library pagination panel style for catalog results. Put Order in this panel.
Do not show an exact page count when the total is unknown.

- Keep the panel visible at the bottom of the result region during first loads and replacement requests.
- Disable navigation and sort controls while loading.
- Do not use old continuation flags for a new request.
- Show skeleton cards or rows that match the selected layout and result dimensions.
- Hide skeleton shapes from assistive technology. Keep the loading status announcement.
- Disable skeleton animation when the user requests reduced motion.
- Remove skeletons on success, failure or offline state.

## Toast messages

- Show a maximum of three toast messages at one time. Include error messages in this limit.
- When a new message exceeds the limit, remove the oldest message.

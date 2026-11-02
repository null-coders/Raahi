# How the photos were chosen

`data/media/photos.json` holds the photo for every destination, place and "Life here" slot. It was built once, not at runtime:

1. **Harvest.** For each destination and place, candidate photos were collected from Wikimedia: the Wikipedia article's lead image and gallery, Wikipedia search, and Commons search (Quality Images first). Then each file's size, author and licence were fetched from the Commons API. (The raw harvest, about 8,000 files, is not kept in the repo.)
2. **Select** (`select_photos.py`). Keep large, landscape JPEGs. Drop maps, logos, documents, old drawings, official events and adult-only sculpture. Keep only photos whose file name matches the place, its destination or its state. Remove near-duplicates. Give each place its own lead photo where possible.
3. **Review by hand** (`overrides.json`). Every card photo and "Life here" photo was looked at, and the overrides list drops wrong ones (another country, a person who just shares the name…) and picks better lead photos.

Places without a good photo of their own borrow one from their destination's gallery in the app, so nothing shows a wrong guess.

4. **Second review** (`review.json`, applied by `apply_review.py`). Every photo of every place, destination and "Life here" slot was checked again on contact sheets. Wrong ones were dropped (for example Sarnath had a portrait, a stone relief and an old drawing; Somnath had a floor plan), better card photos moved to the front, and about 40 places got new photos from fresh Commons searches (Dhamek Stupa for Sarnath, Tunday Kababi for Lucknow's food walk, the lit-up Mysore Palace…).

Run: `python3 select_photos.py <folder with harvest.json, photo-ids.json, photo-input.json> ../../data/media/photos.json`
Then: `python3 apply_review.py ../../data/media/photos.json`

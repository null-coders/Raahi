"""Apply the hand review (review.json) to data/media/photos.json.

    python3 apply_review.py ../../data/media/photos.json

Run it after select_photos.py. It is idempotent: running it twice gives the same file.
  drop  - remove photos that show the wrong thing (another place, a map, an old drawing, a person)
  lead  - move the best photo to the front (it becomes the card photo)
  add   - add photos found by a new Commons search; the hash folder is md5 of the file name
  life  - clear "Life here" slots; the app then shows a photo from the destination's gallery
"""
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
MAX_PLACE, MAX_DEST = 4, 8


def entry(file, w, h, artist, licence):
    name = file.replace(' ', '_')
    md5 = hashlib.md5(name.encode('utf-8')).hexdigest()
    return [name, f'{md5[0]}/{md5[:2]}', w, h, artist, licence]


def patch(arr, rule, cap):
    drop = set(rule.get('drop', []))
    out = [e for e in arr if e[0] not in drop]
    names = {e[0] for e in out}
    for a in rule.get('add', []):
        e = entry(*a)
        if e[0] not in names and e[0] not in drop:
            out.append(e)
            names.add(e[0])
    lead = rule.get('lead')
    if lead and lead not in drop:
        out.sort(key=lambda e: e[0] != lead)
    return out[:cap]


def main(path):
    photos = json.loads(pathlib.Path(path).read_text())
    review = json.loads((HERE / 'review.json').read_text())
    for key, rule in review['place'].items():
        photos['place'][key] = patch(photos['place'].get(key) or [], rule, MAX_PLACE)
    for key, rule in review['dest'].items():
        photos['dest'][key] = patch(photos['dest'].get(key) or [], rule, MAX_DEST)
    for key, slots in review['life'].items():
        row = photos['life'].get(key) or [None, None, None]
        for s in slots:
            if s < len(row):
                row[s] = None
        photos['life'][key] = row
    pathlib.Path(path).write_text(json.dumps(photos, ensure_ascii=False, separators=(',', ':')))
    own = sum(1 for v in photos['place'].values() if v)
    print(f"places with their own photos: {own} of {len(photos['place'])}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else str(HERE / '../../data/media/photos.json'))

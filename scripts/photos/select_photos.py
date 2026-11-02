"""Turn the raw Wikimedia harvest into data/media/photos.json (curated photo picks).

Input: harvest.json  {D:[{g,people,festival,food}], P:[[file...]], files:{file:[w,h,isJpeg,artist,license]}}
       photo-ids.json {ids:[destination ids], pids:[place ids]} in the same order as the harvest.
Overrides: overrides.json {"dest:<id>": [files...], "place:<id>": [...], "life:<id>:<n>": file|null, "drop": [files]}
"""
import hashlib, json, re, sys
from pathlib import Path

S = Path(sys.argv[1])
OUT = Path(sys.argv[2])
R = json.loads((S / 'harvest.json').read_text())
IDS = json.loads((S / 'photo-ids.json').read_text())
OV = json.loads((S / 'overrides.json').read_text()) if (S / 'overrides.json').exists() else {}
DROP = set(OV.get('drop', []))
DROP_PREFIX = tuple(OV.get('dropPrefix', []))
DROP_CONTAINS = tuple(OV.get('dropContains', []))
DROP_FOR = {k: tuple(v) for k, v in OV.get('dropFor', {}).items()}
CUR_DEST = ['']

BADTOK = set(('map maps locator location flag flags logo emblem seal icon diagram chart coat signature svg graph census poster '
              'stamp banknote coin painting drawing sketch engraving illustration lithograph watercolor watercolour manuscript plan book '
              'newspaper letter document pdf satellite landsat nasa minister ministers meeting conference inauguration inaugurates rally '
              'election addressing seminar press launch launches chairman governor secretary felicitation cm pm mla mp delegation award '
              'awards dignitaries cabinet officials council erotic erotica zoophilia sex sexual nude naked maithuna mithuna coitus orgy '
              'homosexuality selfie screenshot university college institute iit infosys secretariat hospital kgmu junction '
              'bus planetarium racecourse flood floods stranded cremation trash garbage protest vaccination covid construction '
              'visiting inaugurating inugurating modi president advertising postcard earl bill dollar landslip bl blcollection '
              'blcopyright campus office hotel resort wedding bridal baby kabaddi cricket stadium team accident damaged ruins_of '
              'japan osaka tokyo china chinese hangzhou korea jeju bali ubud indonesia gili philippines davao london walthamstow cromer '
              'overstrand bromley geograph brussels venezia venice kremlin kazan russia hungary ecser vicksburg usa america germany '
              'amrum nordsee nordseestrand palestine jews pakistani nepal thailand vietnam jarai france paris delisle osborne '
              'kormoran egret caterpillar').split())
FOREIGN_OK = set()
EXTRA = re.compile(r'(British_Museum|Metropolitan_Museum|LACMA|Los_Angeles_County|Museum_of_Fine_Arts|Victoria_and_Albert|'
                   r'Smithsonian|Mus[ée]e|Guimet|Brooklyn_Museum|Cleveland_Museum|Art_Institute|Walters|Freer|Rijksmuseum|Wellcome|'
                   r'Asian_Art_Museum|Honolulu|Philadelphia_Museum|National_Museum,_New_Delhi_\(|ASI_Museum)', re.I)


def bad(f):
    toks = re.split(r"[\s_\-.,()'’&+]+", re.sub(r'\.[a-zA-Z]+$', '', f).lower())
    return any(t in BADTOK or (re.fullmatch(r'\d{4}', t) and 1700 <= int(t) < 1950) for t in toks)


def info(f):
    return R['files'].get(f)


def ok(f, minw, lo, hi):
    i = info(f)
    if not i or f in DROP or any(c in f for c in DROP_CONTAINS) or f.startswith(DROP_PREFIX) or f.startswith(DROP_FOR.get(CUR_DEST[0], ('\0',))) or not i[2] or i[0] < minw or bad(f) or EXTRA.search(f):
        return False
    return lo <= i[0] / i[1] <= hi


def entry(f):
    w, h, _, artist, lic = info(f)
    md5 = hashlib.md5(f.encode('utf-8')).hexdigest()
    artist = re.sub(r'\s+', ' ', artist or '').strip() or 'Unknown'
    return [f, f'{md5[0]}/{md5[:2]}', w, h, artist[:48], (lic or '').strip()[:24]]


def near_key(f):
    return re.sub(r'[\d_\-().,]+$', '', re.sub(r'\.[A-Za-z]+$', '', f)).lower()[:24]


def pick(cands, n, tiers, used=()):
    out = []
    seen_near = {near_key(u) for u in used}
    for minw, lo, hi in tiers:
        for f in cands:
            if len(out) >= n:
                return out
            if f not in out and f not in used and near_key(f) not in seen_near and ok(f, minw, lo, hi):
                out.append(f)
                seen_near.add(near_key(f))
    return out


def from_override(key):
    v = OV.get(key)
    if v is None:
        return None
    return [f for f in (v if isinstance(v, list) else [v]) if f and info(f)]


INP = json.loads((S / 'photo-input.json').read_text())
DINFO = {d[0]: d for d in INP['D']}
PINFO = {p[0]: p for p in INP['P']}
GENERIC = set(('light sound show beach lake temple temples fort falls waterfall waterfalls point sunset sunrise walk market village villages '
               'river trek safari ride boat museum church park valley hill hills view viewpoint road mall garden gardens cave caves palace '
               'festival food night evening tour jeep zone range island ghat ghats aarti bazaar group old city town the and from with '
               'at of on in to a day hike trail centre center sanctuary national wildlife tiger reserve house street lane estate tea '
               'coffee spice plantation farm visit cruise sunset viewpoint peak pass dam lakes beaches monastery mandir gate memorial '
               'tank new main local heritage craft crafts food stall shop shops cafe cafes trip fair grounds stay show lights').split())
LATIN = re.compile(r'\([A-Z][a-z]+_[a-z]+')
DEMONYM = set(('kashmiri ladakhi pahari garhwali kumaoni gaddi kinnauri spitian tibetan tibetans lepcha bhutia sikkimese nepali '
               'khasi garo naga nagas apatani mishing mising assamese bodo bengali odia odisha toda badaga kodava konkani goan malayali '
               'tamil telugu kannada marathi gujarati kutchi rajasthani marwari bhil gond baiga punjabi sikh sikhs bundeli banjara '
               'rabari maldhari siddi lambadi').split())


def toks(x):
    return [t for t in re.split(r"[^a-z0-9]+", x.lower().replace('_', ' ')) if len(t) >= 3]


def proper(*names):
    out = set()
    for n in names:
        out |= {t for t in toks(n or '') if t not in GENERIC}
    return out


def relevant(f, keys):
    ft = set(toks(f))
    return bool(ft & keys)


dest, life, place = {}, {}, {}
for i, did in enumerate(IDS['ids']):
    d = R['D'][i] or {'g': [], 'people': [], 'festival': [], 'food': []}
    CUR_DEST[0] = did
    _, dname, dstate, dwiki, dfest, ddish = DINFO[did]
    dplaces = [p for p in INP['P'] if p[0].split('--')[0] == did]
    dkeys = proper(dname, dwiki) | proper(*[p[1] for p in dplaces]) | proper(*[p[3] for p in dplaces])
    skeys = proper(dstate)
    wild = any(w in (dname + dwiki).lower() for w in ['national', 'tiger', 'kanha', 'corbett', 'kaziranga', 'gir', 'ranthambore', 'sundarban'])
    g = from_override(f'dest:{did}')
    if g is None:
        cands = [f for f in d['g'] if wild or not LATIN.search(f)]
        rel = [f for f in cands if relevant(f, dkeys)]
        semi = [f for f in cands if f not in rel and relevant(f, skeys)]
        g = pick(rel + semi, 8, [(1200, 1.2, 2.6), (960, 1.0, 3.0)])
        if len(g) < 4:
            g += pick([f for f in cands if f not in g], 4 - len(g), [(1200, 1.2, 2.6)], used=set(g))
    dest[did] = g
    slots = []
    for k, key in enumerate(['people', 'festival', 'food']):
        ov = OV.get(f'life:{did}:{k}', 'unset')
        if ov != 'unset':
            slots.append(ov if (ov and info(ov)) else None)
            continue
        lk = dkeys | skeys | DEMONYM
        if key == 'festival':
            lk = lk | proper(dfest)
        if key == 'food':
            lk = proper(ddish, dname, dstate) | skeys
        cands = [f for f in d[key] if relevant(f, lk) and not LATIN.search(f)]
        got = pick(cands, 1, [(800, 1.1, 2.4), (800, 0.7, 1.1)], used=set(g) | set(s for s in slots if s))
        slots.append(got[0] if got else None)
    life[did] = slots

by_dest = {}
for k, pid in enumerate(IDS['pids']):
    by_dest.setdefault(pid.split('--')[0], []).append((k, pid))
for did, items in by_dest.items():
    CUR_DEST[0] = did
    primaries = set()
    for k, pid in items:
        ov = from_override(f'place:{pid}')
        if ov is not None:
            lst = ov
        else:
            _, pname, pdest, pwiki, pcat = PINFO[pid]
            dd = DINFO[did]
            keys = proper(pname, pwiki) or proper(pdest, dd[2])
            keys |= proper(pwiki)
            cands = [f for f in (R['P'][k] or []) if relevant(f, keys | proper(pdest)) and (pcat == 'wildlife' or not LATIN.search(f))]
            lst = pick(cands, 4, [(960, 1.0, 2.8), (800, 0.6, 3.0)])
            # give each place its own lead photo where it has one to spare
            fresh = [f for f in lst if f not in primaries]
            if fresh and fresh[0] != lst[0]:
                lst = [fresh[0]] + [f for f in lst if f != fresh[0]]
        if lst:
            primaries.add(lst[0])
        place[pid] = lst

for did, g in dest.items():
    if len(g) < 6:
        extra = [lst[0] for pid, lst in place.items() if pid.split('--')[0] == did and lst and lst[0] not in g]
        extra = [f for f in dict.fromkeys(extra) if info(f)[0] >= 1200 and info(f)[0] / info(f)[1] >= 1.2]
        g = g + extra[: 6 - len(g)]
    first = [f for f in OV.get('first', {}).get(did, []) if info(f)]
    CUR_DEST[0] = did
    g = [f for f in g if ok(f, 0, 0, 99)]
    dest[did] = list(dict.fromkeys(first + g))[:8]

out = {
    'about': 'Curated Wikimedia Commons photos for Raahi. Each entry: [file, hash folder, width, height, author, licence]. '
             'Chosen by scripts/photos/select_photos.py with the hand-made rules in overrides.json; credit is shown on every photo.',
    'dest': {k: [entry(f) for f in v] for k, v in dest.items()},
    'life': {k: [entry(f) if f else None for f in v] for k, v in life.items()},
    'place': {k: [entry(f) for f in v] for k, v in place.items()},  # [] = curated place without its own photo
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))

nd = sum(1 for v in dest.values() if v)
print(f'destinations with photos: {nd}/{len(dest)}; avg gallery {sum(map(len, dest.values())) / len(dest):.1f}')
print('destinations with <4 photos:', [k for k, v in dest.items() if len(v) < 4])
print('life slots filled:', sum(1 for v in life.values() for s in v if s), '/', 3 * len(life))
print('life missing:', {k: [n for n, s in zip(['people', 'festival', 'food'], v) if not s] for k, v in life.items() if not all(v)})
np = sum(1 for v in place.values() if v)
print(f'places with photos: {np}/{len(IDS["pids"])}')
print('places without:', [k for k, v in place.items() if not v])
print('size', OUT.stat().st_size)

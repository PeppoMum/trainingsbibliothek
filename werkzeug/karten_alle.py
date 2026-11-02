"""Fasst die Übungen aller älteren Saisons zu Karten zusammen und hängt sie an die bestehenden Karten (2026/27) an,
wenn es dieselbe Übung ist. Bestehende Karten behalten Kennung, Merkmale und Status; sie bekommen nur weitere Varianten.
Neue Einheiten und Karten sind direkt „aufgenommen“ (Phil, 02.11.2026: ohne Einzelprüfung).
Aufruf: python3 karten_alle.py einheiten_alt.json ../public"""
import json, re, sys, os, shutil, itertools, hashlib
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(__file__))
from baue_daten import woerter, schluessel
from karten import merkmale_fuer
from merkmale_auto import merkmale_auto, schwerpunkte_in

GENERISCH = {'passspiel', 'torschuss', 'ballmastery', '', 'aufbau', 'passform', 'koordination', 'athletik',
             'basistechniken', 'torschussform', 'spielform', 'übungsform', 'abschlussspiel', 'zocken', 'spiel'}

def k2(titel):
    k = schluessel(titel.replace(' ', ' '))
    k = re.sub(r'\bvier\b', '4', k).replace('ggs', 'gegenspieler')
    return k.replace(' ', '')

def titelwoerter(titel):
    k = schluessel(titel.replace('\u00a0', ' '))
    k = re.sub(r'(\d)\s*gg\s*(\d)', r'\1gg\2', re.sub(r'\bvier\b', '4', k))
    return set(w for w in k.split() if w not in ('+', 'im', 'auf', 'mit', 'und', 'der', 'die', 'das', 'dem', 'den'))

def erstes_wort(titel):
    k = schluessel(titel.replace(' ', ' ')).split()
    return k[0] if k else ''

def gleich(a, b):
    """a, b: (key2, erstes Wort, Wörter, Form, Titelwörter)"""
    if a[3] != b[3]: return False
    if a[0] == b[0] and a[0] not in GENERISCH: return True
    if not a[2] or not b[2]: return False
    if a[0] != b[0]:
        ta, tb = a[4], b[4]
        if not ta or not tb or len(ta & tb) / len(ta | tb) < 0.5: return False
    erst = a[1] == b[1] or (a[1][:1].isdigit() and b[1][:1].isdigit())
    return erst and len(a[2] & b[2]) / len(a[2] | b[2]) >= 0.5

GG2 = re.compile(r'((?:\d+\s*\+\s*)*\d+)\s*(?:gegen|gg\.?|vs\.?)\s*(\d+)((?:\s*\+\s*\d+)*)')

def zahlen(titel, teile=None):
    arten, txt = [], []
    for links, b, rechts_plus in GG2.findall(titel.replace('\u00a0', ' ')):
        a = sum(int(x) for x in re.findall(r'\d+', links)); b = int(b)
        plus = '+' in links or bool(rechts_plus.strip())
        txt.append(re.sub(r'\s+', ' ', f"{links} gegen {b}{rechts_plus}").replace('+', ' + ').replace('  ', ' '))
        if b == 0: continue
        arten.append('Gleichzahl' if a == b and not plus else ('Überzahl' if a > b or plus else 'Unterzahl'))
    return list(dict.fromkeys(arten)), ', '.join(dict.fromkeys(re.sub(r'\s+', ' ', t).strip() for t in txt))

def inhalt_text(b):
    return ' '.join(z for t in b['teile'] for z in t['zeilen'])

def main(alt_p, pub):
    vs = json.load(open(os.path.join(pub, 'daten', 'vorschlaege.json')))
    E_neu = vs['einheiten']; K_neu = vs['uebungen']
    E = json.load(open(alt_p))
    E_by = {e['id']: e for e in E}
    U = []
    for e in E:
        for i, b in enumerate(e['bausteine']):
            if b['art'] != 'uebung': continue
            b['titel'] = re.sub(r'\s+', ' ', b['titel'].replace(' ', ' ')).strip()
            if not b['form']:
                b['form'] = 'Spielform' if re.search(r'gegen|\bgg\b|\d\s*gg|Zocken|[Rr]ondo|Turnier|Abschlussspiel', b['titel']) else 'Übungsform'
            U.append((e, i, b))
    # Knoten: erst alte Übungen, dann bestehende Karten (mit mehreren Mitgliedern)
    mitglieder = [[(k2(b['titel']), erstes_wort(b['titel']), woerter(b), b['form'], titelwoerter(b['titel']))] for _, _, b in U]
    anker = [None] * len(U)
    for k in K_neu:
        mitglieder.append([(k2(v['titel']), erstes_wort(v['titel']), woerter({'teile': v['teile']}), k['form'], titelwoerter(v['titel'])) for v in k['varianten']])
        anker.append(k['id'])
    n = len(mitglieder); par = list(range(n)); komp_anker = {i: anker[i] for i in range(n)}
    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    def vereinige(i, j):
        a, b = f(i), f(j)
        if a == b: return
        if komp_anker[a] and komp_anker[b]: return   # zwei bestehende Karten nie zusammenlegen
        par[a] = b; komp_anker[b] = komp_anker[b] or komp_anker[a]
    for i, j in itertools.combinations(range(n), 2):
        if any(gleich(x, y) for x in mitglieder[i] for y in mitglieder[j]):
            vereinige(i, j)
    gruppen = defaultdict(list)
    for i in range(n): gruppen[f(i)].append(i)

    os.makedirs(os.path.join(pub, 'skizzen'), exist_ok=True)
    K_by = {k['id']: k for k in K_neu}
    def variante(e, pos, b):
        sk = []
        for kk, p in enumerate(b['skizzen']):
            name = f"{e['id']}-{(b['label'] or 'x').lower()}-{pos}-{kk}.svg"
            shutil.copy(p, os.path.join(pub, 'skizzen', name)); sk.append('skizzen/' + name)
        return {'einheit': e['id'], 'datum': e['datum'], 'label': b['label'], 'titel': b['titel'], 'skizzen': sk, 'teile': b['teile']}

    neue_karten, erweitert = [], 0
    for root, idxs in gruppen.items():
        alt = sorted([i for i in idxs if i < len(U)], key=lambda i: (U[i][0]['datum'], U[i][1]))
        if not alt: continue
        kid = komp_anker[root]
        varianten = [variante(*U[i]) for i in alt]
        if kid:
            k = K_by[kid]
            k['varianten'] = sorted(k['varianten'] + varianten, key=lambda v: v['datum'])
            k['jugend'] = sorted(set(k['jugend']) | {U[i][0]['jugend'] for i in alt if U[i][0]['jugend']})
            erweitert += 1
        else:
            kid = 'u-' + hashlib.md5('|'.join(f"{U[i][0]['id']}#{U[i][1]}" for i in alt).encode()).hexdigest()[:10]
            haeufig = Counter(U[i][2]['titel'] for i in alt).most_common()
            bester = [t for t, c in haeufig if c == haeufig[0][1]]
            e0, _, erste = next(U[i] for i in alt if U[i][2]['titel'] in bester)
            titel = erste['titel']
            if not titel:
                z = next((z for t in erste['teile'] for z in t['zeilen'] if z.strip()), '')
                titel = 'Ohne Titel' + (f' – {z[:60]}' if z else '')
            m = merkmale_fuer(erste['titel'], erste['form']) or merkmale_auto(erste['titel'], erste['form'], inhalt_text(erste), e0['schwerpunkt'])
            arten, txt = [], []
            for i in alt:
                ar, tx = zahlen(U[i][2]['titel'], U[i][2]['teile']); arten += ar
                if tx: txt.append(tx)
            neue_karten.append({
                'id': kid, 'titel': titel, 'form': erste['form'],
                'merkmale': {
                    'spielphasen': m.get('sp', []), 'hauptschwerpunkt': m.get('h', ''), 'schwerpunkte': m.get('w', []),
                    'zweikampf': m.get('zk', []), 'zahl': m.get('zahl') or list(dict.fromkeys(arten)),
                    'zahlText': ', '.join(dict.fromkeys(x.strip() for t in txt for x in t.split(','))),
                    'artSpielform': m.get('art', '') if erste['form'] == 'Spielform' else '', 'ort': m.get('ort', []),
                },
                'jugend': sorted({U[i][0]['jugend'] for i in alt if U[i][0]['jugend']}),
                'qualitaet': U[alt[0]][0]['qualitaet'], 'status': 'aufgenommen', 'varianten': varianten,
            })
        for i in alt: U[i][2]['karte'] = kid

    einheiten_alt = []
    for e in E:
        bs = []
        for b in e['bausteine']:
            if b['art'] == 'uebung':
                bs.append({'art': 'uebung', 'label': b['label'], 'titel': b['titel'], 'form': b['form'], 'karte': b['karte']})
            elif b['art'] == 'titel':
                bs.append({'art': 'titel', 'label': b['label'], 'titel': b['titel'], 'form': b['form']})
            else:
                bs.append({k: v for k, v in b.items() if k in ('art', 'titel', 'zeilen')})
        einheiten_alt.append({k: e[k] for k in ('id', 'datum', 'art', 'mannschaft', 'spieler', 'nummer', 'schwerpunkt', 'saison', 'jugend', 'qualitaet')}
                             | {'bausteine': bs, 'status': 'aufgenommen'})
    alle_e = sorted(E_neu + einheiten_alt, key=lambda e: e['datum'])
    for e in alle_e:
        e['schwerpunkte'] = schwerpunkte_in(e['schwerpunkt'])
    alle_k = K_neu + neue_karten
    json.dump({'version': 2, 'einheiten': alle_e, 'uebungen': alle_k},
              open(os.path.join(pub, 'daten', 'vorschlaege.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(alle_e), 'Einheiten,', len(alle_k), 'Karten (neu', len(neue_karten), ', erweitert', erweitert, '),',
          sum(len(k['varianten']) for k in alle_k), 'Varianten')
    print('Einheiten ohne Schwerpunkt-Zuordnung:', sum(1 for e in alle_e if not e['schwerpunkte']))
    print('Karten ohne Haupt-Schwerpunkt:', sum(1 for k in neue_karten if not k['merkmale']['hauptschwerpunkt']))

if __name__ == '__main__':
    main(*sys.argv[1:])

"""Fasst Übungs-Bausteine zu Karten (mit Varianten) zusammen und schlägt Merkmale vor.
Aufruf: python3 karten.py einheiten.json ausgabe_ordner
Ergebnis: ausgabe_ordner/daten/vorschlaege.json und ausgabe_ordner/skizzen/*.svg"""
import json, re, sys, os, shutil, itertools, hashlib
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(__file__))
from baue_daten import woerter, schluessel

GENERISCH = {'torschuss', 'passspiel', 'ball mastery'}
# Gleiche Grundidee, anderer Name (von Hand festgelegt)
ZUSAMMEN = [('vertikales umschaltspiel', 'umschalten 1 gg 0 bis 2 gg 2')]

# Merkmal-Vorschläge: (Muster im Titel, Form oder None, Merkmale)
MP, GB, US, ST = 'Spiel mit dem Ball', 'Spiel gegen den Ball', 'Umschaltspiel', 'Standardsituationen'
R = [
 (r'^1 gegen 1 & Vororientierung', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', w=['Vororientierung'], zk=['offensiv'])),
 (r'^1 gegen 1 / 2 gegen 2', None, dict(sp=[MP, GB], h='1 gegen 1 und Zweikampf', w=['Zusammenspiel'], zk=['offensiv', 'defensiv'], art='Chaos')),
 (r'Mini-WM', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', zk=['offensiv'])),
 (r'^1 gegen 1 frontal offensiv', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', w=['Finten'], zk=['offensiv', 'frontal', 'nah'])),
 (r'^1 gegen 1 offensiv frontal', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', zk=['offensiv', 'frontal'])),
 (r'^1 gegen 1 seitlich', None, dict(sp=[MP, GB], h='1 gegen 1 und Zweikampf', w=['Dribbling'], zk=['offensiv', 'defensiv', 'seitlich'])),
 (r'^1 gegen 1 zentral offensiv', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', w=['Finten'], zk=['offensiv'], ort=['Zentrum'])),
 (r'^2 \+ 2 \+ 2 gegen 2', None, dict(sp=[MP], h='Vororientierung', w=['Zusammenspiel', 'Raumaufteilung'], art='ohne feste Richtung')),
 (r'^2 gegen 1 & 3 gegen 2', None, dict(sp=[MP], h='Zusammenspiel', w=['Kreieren von Torchancen'], art='mit fester Richtung')),
 (r'^2 gegen 1 im Zentrum', None, dict(sp=[MP], h='Zusammenspiel', w=['1 gegen 1 und Zweikampf'], zk=['offensiv', 'nachrückender Gegenspieler'], ort=['Zentrum'], art='mit fester Richtung')),
 (r'^2 gegen 2 Offensiv', None, dict(sp=[MP, GB], h='Zusammenspiel', w=['Verteidigen in der Gruppe'], art='mit fester Richtung')),
 (r'^2 gegen 2 plus Wandspieler', None, dict(sp=[MP], h='Zusammenspiel', w=['Vororientierung'], zahl=['Überzahl'], art='mit fester Richtung')),
 (r'^3 gegen 2 mit wechselndem', None, dict(sp=[MP, US], h='Zusammenspiel', w=['Umschaltverhalten'], art='mit fester Richtung')),
 (r'^3 gegen 3 / 4 gegen 4 auf 2 Feldern', None, dict(sp=[MP], h='Zusammenspiel', w=['Raumaufteilung'])),
 (r'^4 gegen 4 \+ 2 \(\+2 TW\)', None, dict(sp=[MP], h='Zusammenspiel', w=['Raumaufteilung', 'Vororientierung', 'Passspiel'], art='mit fester Richtung')),
 (r'^(4 gegen 4 \+ [34]|3 gegen 3 \+ 3)$', None, dict(sp=[MP, GB], h='Zusammenspiel', w=['Pressing', 'Vororientierung', 'Passspiel'], art='ohne feste Richtung')),
 (r'^6 gegen 4$', None, dict(sp=[MP], h='Vororientierung', w=['Zusammenspiel'], art='ohne feste Richtung')),
 (r'(\+ TW|\+ 2 TW)$', 'Spielform', dict(sp=[MP, GB, US], h='Pressing', w=['Raumaufteilung', 'Umschaltverhalten'], art='mit fester Richtung')),
 (r'^8gg1 bis 8gg7', None, dict(sp=[MP, GB], h='Passspiel', w=['Pressing', 'Umschaltverhalten', 'Vororientierung'], zahl=['Überzahl'])),
 (r'^Agility-Drill', None, dict(h='Schnelligkeit', w=['Koordination'])),
 (r'^Anbieten und Freilaufen', None, dict(sp=[MP], h='Zusammenspiel', w=['Vororientierung', 'Spielverlagerung'], art='mit fester Richtung')),
 (r'^Angriffskopfball', None, dict(h='Kopfball', w=['Torschuss'])),
 (r'^Ball-Mastery', None, dict(h='Ball Mastery', w=[])),
 (r'^Basistechniken', None, dict(h='Basistechniken allgemein', w=['Dribbling', 'Finten'])),
 (r'^Chaos 1 gegen 1', None, dict(sp=[MP, GB, US], h='1 gegen 1 und Zweikampf', w=['Umschaltverhalten', 'Zusammenspiel'], zk=['offensiv', 'defensiv'])),
 (r'^Doppelrondo', None, dict(sp=[MP], h='Zusammenspiel', w=['Passspiel', 'Vororientierung'], zahl=['Überzahl'])),
 (r'^Dribbling im Wettkampf', None, dict(h='Dribbling', w=['Finten', 'Torschuss'])),
 (r'^Finten - Wettkampf', None, dict(h='Finten', w=['Dribbling'])),
 (r'^Fintenstern', None, dict(h='Finten', w=[])),
 (r'^First-Touch', None, dict(h='Ballan- und -mitnahme', w=['Vororientierung'])),
 (r'^Iniesta-Rondo', None, dict(sp=[MP], h='Vororientierung', w=['Zusammenspiel'], zahl=['Überzahl'], art='Rondo')),
 (r'^(Koordination|Athletik-Parcours)', None, dict(h='Koordination', w=['Schnelligkeit'])),
 (r'^Lucassen', None, dict(sp=[MP], h='1 gegen 1 und Zweikampf', w=['Dribbling', 'Finten'], zk=['offensiv'])),
 (r'^Orientierung im Raum', None, dict(sp=[MP], h='Vororientierung', w=['Raumaufteilung'], art='ohne feste Richtung')),
 (r'^Passspiel Steil-Klatsch', None, dict(h='Passspiel', w=['Zusammenspiel'])),
 (r'^Passspiel Doppelpass', None, dict(h='Passspiel', w=['Zusammenspiel'])),
 (r'^Passspiel Hinterlaufen', None, dict(h='Passspiel', w=['Zusammenspiel'])),
 (r'^Passspiel Vororientierung', None, dict(h='Vororientierung', w=['Passspiel'])),
 (r'^Passspiel über Dritte', None, dict(sp=[MP], h='Zusammenspiel', w=['Passspiel', 'Spieleröffnung'])),
 (r'^Passspiel$', None, dict(h='Passspiel', w=[])),
 (r'^Spiel über Dritten', None, dict(sp=[MP], h='Zusammenspiel', w=[], ort=['Zentrum'])),
 (r'^Standards Ecken', None, dict(sp=[ST], h='', w=[])),
 (r'^Technikviereck', None, dict(h='Dribbling', w=['Finten', 'Basistechniken allgemein'])),
 (r'^Torschuss 1 gegen 1', None, dict(sp=[MP], h='Torschuss', w=['1 gegen 1 und Zweikampf', 'Umschaltverhalten'], zk=['offensiv'])),
 (r'^Torschuss 1\. Kontakt', None, dict(h='Torschuss', w=['Ballan- und -mitnahme', 'Vororientierung'])),
 (r'^Torschuss Steil-Klatsch', None, dict(h='Torschuss', w=['Zusammenspiel', 'Passspiel'])),
 (r'^Torschuss Vororientierung', None, dict(h='Torschuss', w=['Vororientierung', 'Ballan- und -mitnahme'])),
 (r'^Torschuss über Dritte', None, dict(sp=[MP], h='Torschuss', w=['Zusammenspiel', 'Passspiel'])),
 (r'^Torschuss$', None, dict(h='Torschuss', w=['Passspiel'])),
 (r'^Turnier', None, dict(sp=[MP], h='Raumaufteilung', w=['Zusammenspiel'], art='Spaß und Wettkampf')),
 (r'^Umschaltspiel \d gegen \d', None, dict(sp=[US], h='Umschaltverhalten', w=['Verteidigen in der Gruppe', 'Zusammenspiel'])),
 (r'(Umschaltspiel - 1 gegen 0|^Umschalten 1 gegen 0)', None, dict(sp=[US], h='Umschaltverhalten', w=['1 gegen 1 und Zweikampf', 'Verteidigen in der Gruppe'], zahl=['Überzahl', 'Gleichzahl'])),
 (r'^Vier-Farben-Reaktionsspiel', None, dict(h='Wahrnehmung und Kognition', w=['Koordination'])),
 (r'Vier-Farben-Spiel', None, dict(h='Wahrnehmung und Kognition', w=['Koordination'])),
 (r'^Zocken mit Provokationsregeln', None, dict(sp=[MP], h='Zusammenspiel', w=[])),
]

GG = re.compile(r'(\d+)\s*(?:\+\s*\d+\s*)*(?:gegen|gg)\s*(\d+)')

def zahlen(titel, teile):
    t = titel.replace('2 + 2 + 2 gegen 2', '6 gegen 2')
    paare = [(int(a), int(b)) for a, b in GG.findall(t)]
    # „+ 3“ / „+ TW“ nach „4 gegen 4“: Plus-Spieler = Überzahl für den Ballbesitz
    plus = re.search(r'gegen\s*\d+\s*\+\s*\d', t)
    arten = []
    for a, b in paare:
        if b == 0: continue
        arten.append('Gleichzahl' if a == b and not plus else ('Überzahl' if a > b or plus else 'Unterzahl'))
    txt = ', '.join(dict.fromkeys(f'{a} gegen {b}' for a, b in paare))
    return list(dict.fromkeys(arten)), txt

def merkmale_fuer(titel, form):
    for muster, f, m in R:
        if re.search(muster, titel) and (f is None or f == form):
            return m
    return None

def main(pfad, ziel):
    E = json.load(open(pfad))
    os.makedirs(os.path.join(ziel, 'skizzen'), exist_ok=True)
    os.makedirs(os.path.join(ziel, 'daten'), exist_ok=True)
    U = []
    for e in E:
        for i, b in enumerate(e['bausteine']):
            if b['art'] != 'uebung': continue
            if not b['form']:
                b['form'] = 'Spielform' if re.search(r'gegen|Zocken', b['titel']) else 'Übungsform'
            U.append((e, i, b))
    n = len(U); par = list(range(n))
    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    K = [schluessel(b['titel']) for _, _, b in U]
    W = [woerter(b) for _, _, b in U]
    for i, j in itertools.combinations(range(n), 2):
        bi, bj = U[i][2], U[j][2]
        if bi['form'] != bj['form']: continue
        if K[i] == K[j] and K[i] not in GENERISCH:
            par[f(i)] = f(j); continue
        a, b = W[i], W[j]
        erstes_gleich = K[i].split()[0] == K[j].split()[0] or (K[i][:1].isdigit() and K[j][:1].isdigit())
        if a and b and erstes_gleich and len(a & b) / len(a | b) >= 0.5:
            par[f(i)] = f(j)
    for x, y in ZUSAMMEN:
        ii = [i for i in range(n) if K[i].startswith(x)]; jj = [i for i in range(n) if K[i].startswith(y)]
        for i in ii:
            for j in jj: par[f(i)] = f(j)
    gruppen = defaultdict(list)
    for i in range(n): gruppen[f(i)].append(i)

    karten = []
    fehlende = []
    for idxs in sorted(gruppen.values(), key=lambda v: min(U[i][0]['datum'] for i in v)):
        idxs.sort(key=lambda i: (U[i][0]['datum'], U[i][1]))
        haeufig = Counter(U[i][2]['titel'] for i in idxs).most_common()
        bester = [t for t, c in haeufig if c == haeufig[0][1]]
        erste = next(U[i][2] for i in idxs if U[i][2]['titel'] in bester)
        kid = 'u-' + hashlib.md5('|'.join(f"{U[i][0]['id']}#{U[i][1]}" for i in idxs).encode()).hexdigest()[:10]
        m = merkmale_fuer(erste['titel'], erste['form'])
        if m is None:
            fehlende.append(erste['titel']); m = dict(h='', w=[])
        alle_arten, alle_txt = [], []
        varianten = []
        for i in idxs:
            e, pos, b = U[i]
            sk = []
            for k, p in enumerate(b['skizzen']):
                name = f"{e['id']}-{(b['label'] or 'x').lower()}-{pos}-{k}.svg"
                shutil.copy(p, os.path.join(ziel, 'skizzen', name)); sk.append('skizzen/' + name)
            ar, tx = zahlen(b['titel'], b['teile'])
            alle_arten += ar
            if tx: alle_txt.append(tx)
            varianten.append({'einheit': e['id'], 'datum': e['datum'], 'label': b['label'], 'titel': b['titel'],
                              'skizzen': sk, 'teile': b['teile']})
            b['karte'] = kid
        zahl_arten = m.get('zahl') or list(dict.fromkeys(alle_arten))
        karten.append({
            'id': kid, 'titel': erste['titel'], 'form': erste['form'],
            'merkmale': {
                'spielphasen': m.get('sp', []), 'hauptschwerpunkt': m.get('h', ''), 'schwerpunkte': m.get('w', []),
                'zweikampf': m.get('zk', []), 'zahl': zahl_arten, 'zahlText': ', '.join(dict.fromkeys(x.strip() for t in alle_txt for x in t.split(','))),
                'artSpielform': m.get('art', '') if erste['form'] == 'Spielform' else '', 'ort': m.get('ort', []),
            },
            'jugend': sorted(set(U[i][0]['jugend'] for i in idxs if U[i][0]['jugend'])),
            'qualitaet': U[idxs[0]][0]['qualitaet'],
            'status': 'vorschlag', 'varianten': varianten,
        })
    einheiten = []
    for e in E:
        bs = []
        for b in e['bausteine']:
            if b['art'] == 'uebung':
                bs.append({'art': 'uebung', 'label': b['label'], 'titel': b['titel'], 'form': b['form'], 'karte': b['karte']})
            elif b['art'] == 'titel':
                bs.append({'art': 'titel', 'label': b['label'], 'titel': b['titel'], 'form': b['form']})
            else:
                bs.append({k: v for k, v in b.items() if k in ('art', 'titel', 'zeilen')})
        einheiten.append({k: e[k] for k in ('id', 'datum', 'art', 'mannschaft', 'spieler', 'nummer', 'schwerpunkt', 'saison', 'jugend', 'qualitaet')}
                         | {'bausteine': bs, 'status': 'vorschlag'})
    json.dump({'version': 1, 'einheiten': einheiten, 'uebungen': karten}, open(os.path.join(ziel, 'daten', 'vorschlaege.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(einheiten), 'Einheiten,', len(karten), 'Karten,', sum(len(k['varianten']) for k in karten), 'Varianten')
    if fehlende: print('OHNE MERKMALE:', fehlende)
    for k in karten:
        mm = k['merkmale']
        print(f"- {k['titel']} [{k['form']}] x{len(k['varianten'])} | {mm['hauptschwerpunkt']} + {mm['schwerpunkte']} | {mm['spielphasen']} | {mm['zahl']} {mm['zahlText']} | {mm['artSpielform']} {mm['ort']}")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

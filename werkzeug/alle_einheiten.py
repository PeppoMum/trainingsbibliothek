"""Baut die Einheiten aller älteren Saisons (ohne 2026/27).
Datum, Saison und Nummer kommen aus der fertigen PDF (Dateiname), nicht aus der Kopfzeile.
Aufruf: python3 alle_einheiten.py roh.json zuordnung.json einheiten.json"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
import baue_daten as bd

# Korrekturen, die nach dem Satz in den PDFs gemacht wurden (Abgleich PDF gegen Quelle, 02.11.2026)
ERSETZEN = [
    (r'\b2K\b', 'ZK'), (r'\b[üÜ]berzeugen\b', 'erzeugen'), (r'manueller Pass', 'eventueller Pass'),
    (r'1ber zu 1ber', '16er zu 16er'), (r'IV 1er Kante', 'IV 16er Kante'), (r'Lücke/Blanks/', 'Lücke/blank/'),
    (r'Kontakt 6 gibt Richtung', '1. Kontakt gibt Richtung'), (r'RistSpann', 'Rist / Spann'),
]
TW = re.compile(r'Torwarttraining|\bTWT\b')

def fix(z):
    for a, b in ERSETZEN: z = re.sub(a, b, z)
    return z

def sp_ohne_tw(sp):
    zeilen = []
    for z in sp.split('\n'):
        teile = [t for t in re.split(r'\s*\|\s*', z) if not TW.search(t)]
        z = ' | '.join(teile).strip()
        if z and z not in ('SP:',): zeilen.append(z)
    return '\n'.join(zeilen)

def main(roh_p, zu_p, ziel):
    R = json.load(open(roh_p)); Z = json.load(open(zu_p))
    auswahl, meta = [], []
    for r in R:
        if r['ordner'].startswith('2026_27'): continue
        z = Z.get(r['ordner'])
        if not z: print('ohne PDF, weggelassen:', r['ordner'], r['kopf'], file=sys.stderr); continue
        # SP steht bei manchen Trainingslager-Seiten im ersten Block
        if not r['sp'].strip() and r['bloecke'] and not r['bloecke'][0]['kopf'] and r['bloecke'][0]['teile'] \
                and r['bloecke'][0]['teile'][0]['zeilen'][0].startswith('SP:'):
            r['sp'] = '\n'.join(r['bloecke'][0]['teile'].pop(0)['zeilen'])
        r['sp'] = fix(sp_ohne_tw(r['sp']))
        for b in r['bloecke']:
            b['kopf'] = fix(b['kopf'])
            for t in b['teile']:
                t['zeilen'] = [fix(x) for x in t['zeilen'] if not TW.search(x)]
        m = re.match(r'(\d{4})-(\d\d)-(\d\d)(?: \((?:(\d+)\. Einheit|(.+))\))?$', z['pdf'])
        yy, mm, dd, nr, alt = m.groups()
        art = 'Trainingslager' if r['kopf'].startswith('Trainingslager') else 'Training'
        tm = re.search(r'U\d+', r['kopf'])
        rest = ''
        km = re.search(r'\d{1,2}\.\d{1,2}\.(?:\d{2,4})?\s*–\s*(.+)$', r['kopf'])
        if km: rest = km.group(1).strip()
        rest = re.sub(r'^\d+\.\s*Einheit\s*(–\s*)?', '', rest).strip()
        r['kopf'] = f"{art} {tm.group(0) if tm else 'U??'} – {dd}.{mm}.{yy}"
        auswahl.append(r)
        meta.append(dict(saison=z['saison'][7:11] + '/' + z['saison'][12:14], nr=nr, alt=alt,
                         spieler=rest if re.match(r'^[\d/ +x]+(Spieler)?$', rest) else '', team=tm.group(0) if tm else ''))
    json.dump(auswahl, open(ziel + '.roh', 'w'), ensure_ascii=False)
    E = bd.lade(ziel + '.roh'); os.remove(ziel + '.roh')
    assert len(E) == len(auswahl)
    letzte_mannschaft = {}
    for e, mt in sorted(zip(E, meta), key=lambda x: x[0]['datum']):
        if mt['team']: letzte_mannschaft[mt['saison']] = mt['team']
    for e, mt in zip(E, meta):
        team = mt['team'] or letzte_mannschaft.get(mt['saison'], '')
        e['mannschaft'] = team; e['jugend'] = bd.jugend_von(team)
        e['saison'] = mt['saison']; e['qualitaet'] = bd.qualitaet_von(mt['saison'])
        e['spieler'] = mt['spieler']
        alt = {'Alternativ': 'Alternative'}.get(mt['alt'], mt['alt'] or '')
        e['nummer'] = f"{mt['nr']}. Einheit" if mt['nr'] else alt
        e['id'] = e['datum'] + (('-' + mt['nr']) if mt['nr'] else ('-' + re.sub(r'[^a-z0-9]', '', alt.lower()) if alt else ''))
    ids = [e['id'] for e in E]; assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
    json.dump(E, open(ziel, 'w'), ensure_ascii=False, indent=1)
    print(len(E), 'Einheiten,', sum(1 for e in E for b in e['bausteine'] if b['art'] == 'uebung'), 'Übungen')

if __name__ == '__main__':
    main(*sys.argv[1:])

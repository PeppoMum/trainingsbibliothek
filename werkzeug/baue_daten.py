"""Baut aus den Rohdaten (parse_seiten.py) Einheiten und Übungskarten (mit Varianten)."""
import json, re, sys, os, hashlib
from datetime import date

KREIS = '①②③④⑤⑥⑦⑧⑨⑩'
LABEL = re.compile(r'^\s*(A\d?|H\d?|AS|S|ZW)\s*\)\s*(.*)$')
BAUSTEIN_IN_TEXT = re.compile(r'^\s*((?:A\d?|H\d?|AS)(?:\s*/\s*(?:A\d?|H\d?|AS))*\)?(?:\s*&\s*(?:A\d?|H\d?|AS)\))?)\s*(.*)$')

def saison_von(d):
    return f"{d.year}/{str(d.year+1)[2:]}" if d.month >= 7 or (d.month == 6 and d.day >= 15) else f"{d.year-1}/{str(d.year)[2:]}"

def jugend_von(team):
    m = re.search(r'U(\d+)', team or '')
    if not m: return ''
    u = int(m.group(1))
    return {10:'E',11:'E',12:'D',13:'D',14:'C',15:'C'}.get(u, '')

def qualitaet_von(saison):
    j = int(saison[:4])
    return 'niedrig' if j <= 2021 else ('mittel' if j == 2022 else 'hoch')

def form_und_titel(rest):
    rest = rest.strip()
    for pre, form in (('ÜF', 'Übungsform'), ('SF', 'Spielform'), ('Übungsform', 'Übungsform'), ('Spielform', 'Spielform')):
        if rest.startswith(pre + ' '):
            return form, rest[len(pre):].strip()
    return '', rest

def schluessel(t):
    t = t.lower().replace('gegen', 'gg').replace('–', '-')
    t = re.sub(r'\bgg\b', 'gg', t)
    t = re.sub(r'[^a-z0-9äöüß+→ ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()

def bereinige_zeile(z):
    z = z.strip()
    z = re.sub(r'^-\s+', '', z)   # Spiegelstrich ist nur Aufzählungszeichen
    return z

def teile_sauber(teile):
    out = []
    for t in teile:
        zeilen = [bereinige_zeile(z) for z in t['zeilen'] if z.strip()]
        if t['art'] == 'text' and zeilen and all(z[:1] in KREIS for z in zeilen):
            zeilen.sort(key=lambda z: KREIS.index(z[0]))
        if zeilen and zeilen[0] in ('Ablauf:',):
            zeilen = zeilen[1:]
            t = dict(t, art='ablauf')
        if zeilen:
            out.append({'art': t['art'], 'zeilen': zeilen})
    return out

def lade(roh_pfad):
    roh = json.load(open(roh_pfad))
    einheiten = []
    for e in roh:
        m = re.match(r'^(Training(?:slager)?)\s+(\S+)\s+–\s+(\d\d)\.(\d\d)\.(\d{4})\s*(?:–\s*(.*))?$', e['kopf'])
        if not m:
            print('KOPF?', e['kopf'], file=sys.stderr); continue
        art, team, dd, mm, yy, rest = m.groups()
        d = date(int(yy), int(mm), int(dd))
        spieler, nr = '', ''
        if rest:
            if 'Einheit' in rest: nr = rest.strip()
            else: spieler = rest.strip()
        sp = re.sub(r'^SP:\s*', '', e['sp'])
        eid = d.isoformat() + (('-' + re.sub(r'\D', '', nr)) if nr else '')
        saison = saison_von(d)
        bausteine = []
        for b in e['bloecke']:
            teile = teile_sauber(b['teile'])
            # Marker „Teil 1/2“ und Bausteinzeilen aus Textteilen lösen
            nach = []
            neue = []
            for t in teile:
                if t['art'] == 'text':
                    rest_z = []
                    for z in t['zeilen']:
                        if re.match(r'^Teil \d$', z):
                            nach.append({'art': 'abschnitt', 'titel': z})
                        elif LABEL.match(z) or re.match(r'^(H\d|AS|A\d)/(H\d|AS|A\d)\)', z) or re.match(r'^H\d\) & H\d\)', z):
                            nach.append({'art': 'hinweis', 'titel': z})
                        else:
                            rest_z.append(z)
                    if rest_z: neue.append(dict(t, zeilen=rest_z))
                else:
                    neue.append(t)
            teile = neue
            kopf = b['kopf'].strip()
            lm = LABEL.match(kopf)
            if not kopf and not b['skizzen']:
                for t in teile:
                    for z in t['zeilen']:
                        bausteine.append({'art': 'abschnitt' if re.match(r'^Teil \d$', z) else 'hinweis', 'titel': z})
                bausteine += nach
                continue
            letzte = [x for x in bausteine if x['art'] == 'uebung']
            if not lm and kopf.endswith(':') and letzte:
                # z. B. „Beispielhafte Lösungsansätze:“ gehört zum Baustein davor
                vb = letzte[-1]
                vb['teile'].append({'art': 'text', 'zeilen': [kopf] + [z for t in teile for z in t['zeilen']]})
                vb['skizzen'] += b['skizzen']
                bausteine += nach
                continue
            if not lm and not b['skizzen']:
                # z. B. „Hauptteil 40 Minuten“, „Aktivierung 20 Minuten“: Hinweis in der Einheit, keine Übung
                bausteine.append({'art': 'hinweis', 'titel': kopf, 'zeilen': [z for t in teile for z in t['zeilen']]})
                bausteine += nach
                continue
            if lm:
                label, rest = lm.group(1), lm.group(2)
            else:
                label, rest = '', kopf
            rest = re.sub(r'\s+CP:.*$', '', rest)
            form, titel = form_und_titel(rest)
            hat_inhalt = bool(teile or b['skizzen'])
            bausteine.append({'art': 'uebung' if hat_inhalt else 'titel', 'label': label, 'form': form,
                              'titel': titel.rstrip(':').strip(), 'teile': teile, 'skizzen': list(b['skizzen'])})
            bausteine += nach
        einheiten.append({'id': eid, 'datum': d.isoformat(), 'art': art, 'mannschaft': team, 'spieler': spieler,
                          'nummer': nr, 'schwerpunkt': sp, 'saison': saison, 'jugend': jugend_von(team),
                          'qualitaet': qualitaet_von(saison), 'bausteine': bausteine})
    return einheiten

def woerter(b):
    t = ' '.join(z for x in b['teile'] for z in x['zeilen']).lower()
    return set(w for w in re.findall(r'[a-zäöüß0-9]{3,}', t))

def svg_hash(paths):
    return [hashlib.md5(open(p, 'rb').read()).hexdigest() for p in paths]

if __name__ == '__main__':
    E = lade(sys.argv[1])
    json.dump(E, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    alle = [(e, b) for e in E for b in e['bausteine'] if b['art'] == 'uebung']
    print(len(E), 'Einheiten,', len(alle), 'Übungs-Bausteine')
    for e, b in alle:
        print(e['datum'], b['label'], '|', b['form'], '|', b['titel'], '| sk', len(b['skizzen']), '| key', schluessel(b['titel']))

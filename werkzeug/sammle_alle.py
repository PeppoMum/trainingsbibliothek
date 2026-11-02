"""Sammelt alle digitalisierten Seiten (alle Saisons) und parst sie. Aufruf: python3 sammle_alle.py <arbeit-ordner> <roh.json>"""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(__file__))
from parse_seiten import parse_page

# je Teilordner: welche HTML-Datei die fertige Seite ist
WAHL = {'2021_22_Teil3': 'svgs/seite.html', '2022_23_Teil2': 'svg/seite.html',
        '2024_25_Teil1': 'out/seite.html', '2024_25_Teil3': 'out/seite.html'}

def main(base, ziel):
    out = []
    for teil in sorted(os.listdir(base)):
        if not os.path.isdir(os.path.join(base, teil)): continue
        name = WAHL.get(teil, 'seite.html')
        pfade = sorted(glob.glob(os.path.join(base, teil, '*', name)))
        if teil == '2026_27':
            pfade += sorted(glob.glob(os.path.join(base, teil, '*', '*_vorlage.html')))
        for p in pfade:
            if '/tw/' in p: continue
            r = parse_page(p); r['ordner'] = teil + '/' + os.path.relpath(p, os.path.join(base, teil)).split('/')[0]
            out.append(r)
    json.dump(out, open(ziel, 'w'), ensure_ascii=False, indent=1)
    print(len(out), 'Seiten')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

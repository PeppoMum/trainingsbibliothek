"""Ordnet jede Quellseite der fertigen PDF zu (Dateiname JJJJ-MM-TT = Trainingsdatum, Ordner = Saison).
Aufruf: python3 zuordnung.py roh.json txt-ordner zuordnung.json"""
import sys, os, json, re, glob

def norm(t): return re.sub(r'\s+', ' ', t.replace(' ', ' ')).strip()
def woerter(t): return set(re.findall(r'[a-zäöüß0-9]{3,}', t.lower()))

def seitentext(r):
    teile = [r['kopf'], r['sp']]
    for b in r['bloecke']:
        teile.append(b['kopf'])
        for t in b['teile']: teile += t['zeilen']
    return ' '.join(teile)

def main(roh, txtdir, ziel):
    R = json.load(open(roh))
    pdfs = {}
    for f in glob.glob(os.path.join(txtdir, '*', '*.txt')):
        s = os.path.basename(os.path.dirname(f)); n = os.path.basename(f)[:-4]
        t = open(f).read(); zeilen = [z for z in t.split('\n') if z.strip()]
        pdfs[(s, n)] = (norm(zeilen[0]) if zeilen else '', woerter(t))
    paare = []
    for i, r in enumerate(R):
        teil = r['ordner'].split('/')[0]
        saison = 'Saison ' + teil[:4] + ' ' + teil[5:7]
        w = woerter(seitentext(r)); k = norm(r['kopf'])
        for (s, n), (kp, wp) in pdfs.items():
            if s != saison: continue
            j = len(w & wp) / max(1, len(w | wp))
            paare.append((j + (1 if kp == k else 0), i, (s, n)))
    paare.sort(reverse=True)
    belegt_i, belegt_p, Z = set(), set(), {}
    for sc, i, p in paare:
        if i in belegt_i or p in belegt_p: continue
        belegt_i.add(i); belegt_p.add(p); Z[R[i]['ordner']] = {'saison': p[0], 'pdf': p[1], 'score': round(sc, 2)}
    json.dump(Z, open(ziel, 'w'), ensure_ascii=False, indent=1)
    print(len(Z), 'zugeordnet von', len(R))
    for r in R:
        z = Z.get(r['ordner'])
        if not z or z['score'] < 1.3: print('UNSICHER', r['ordner'], '|', r['kopf'], '->', z)
    print('PDF ohne Seite:', sorted(p for p in pdfs if p not in belegt_p))

if __name__ == '__main__':
    main(*sys.argv[1:])

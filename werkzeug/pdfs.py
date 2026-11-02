"""Legt die fertigen A4-PDFs als public/pdf/<einheit-id>.pdf ab und trägt das Feld „pdf“ in die Einheiten ein.
Aufruf: python3 pdfs.py /mnt/project-files/digitalisiert public"""
import sys, os, re, json, glob, shutil

def main(quelle, pub):
    p = os.path.join(pub, 'daten', 'vorschlaege.json'); d = json.load(open(p))
    ids = {e['id']: e for e in d['einheiten']}
    os.makedirs(os.path.join(pub, 'pdf'), exist_ok=True)
    n = 0
    for f in sorted(glob.glob(os.path.join(quelle, 'Saison *', '*.pdf'))):
        m = re.match(r'^(\d{4}-\d\d-\d\d)(?: \((?:(\d+)\. Einheit|(.+))\))?\.pdf$', os.path.basename(f))
        if not m: continue
        datum, nr, alt = m.groups()
        alt = {'Alternativ': 'Alternative'}.get(alt, alt or '')
        eid = datum + (('-' + nr) if nr else ('-' + re.sub(r'[^a-z0-9]', '', alt.lower()) if alt else ''))
        if eid not in ids: print('keine Einheit zu', f); continue
        shutil.copy(f, os.path.join(pub, 'pdf', eid + '.pdf')); ids[eid]['pdf'] = 'pdf/' + eid + '.pdf'; n += 1
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
    print(n, 'PDFs,', sum(1 for e in d['einheiten'] if not e.get('pdf')), 'Einheiten ohne PDF')

if __name__ == '__main__':
    main(*sys.argv[1:])

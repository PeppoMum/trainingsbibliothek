"""Liest die digitalisierten Seiten (seite.html + SVG) und erzeugt Rohdaten je Einheit."""
import sys, os, re, json, glob
from bs4 import BeautifulSoup, NavigableString

def text_sep(el):
    for br in el.find_all('br'):
        br.replace_with('\n')
    t = el.get_text('\n')
    return '\n'.join(re.sub(r'[ \t]+', ' ', l).strip() for l in t.split('\n') if l.strip())

def li_text(li):
    nested = li.find_all('ul')
    sub = []
    for n in nested:
        sub += [text_of(x) for x in n.find_all('li')]
        n.decompose()
    t = text_of(li)
    return '\n'.join([t] + sub) if sub else t

def text_of(el):
    # <br> -> Zeilenumbruch
    for br in el.find_all('br'):
        br.replace_with('\n')
    return re.sub(r'[ \t]+', ' ', el.get_text()).strip()

def parse_page(path):
    d = os.path.dirname(path)
    roh = open(path, encoding='utf-8').read()
    if '<body' not in roh:
        roh = '<html><body>' + re.sub(r'^HEAD', '', roh) + '</body></html>'
    soup = BeautifulSoup(roh, 'html.parser')
    for x in soup.find_all(['style', 'script', 'head']):
        x.decompose()
    for x in soup.find_all('span', class_='min'):
        x.decompose()  # Minutenangabe gehört nicht in den Titel
    # Torwarttraining: ab der Überschrift „TWT“ alles weg
    for x in soup.find_all('p', class_='t'):
        if x.parent is soup.body and x.get_text(strip=True) == 'TWT':
            for y in list(x.find_next_siblings()):
                y.decompose()
            x.decompose()
    h1 = soup.find('h1')
    kopf = text_of(h1) if h1 else ''
    sp = soup.find('p', class_='sp')
    sp_t = text_of(sp) if sp else ''
    body = soup.body
    bloecke = []
    POS = {id(x): i for i, x in enumerate(body.descendants)}
    cur = None
    for el in body.children:
        if isinstance(el, NavigableString) or el.name in ('h1',):
            continue
        if el.name == 'p' and 'sp' in (el.get('class') or []):
            continue
        t = el.find('p', class_='t') if el.name == 'div' else None
        if t is not None and 'b' in (el.get('class') or []):
            cur = {'kopf': text_of(t), 'teile': [], 'skizzen': []}
            bloecke.append(cur)
            t.decompose()
            target = el
        else:
            if cur is None:
                cur = {'kopf': '', 'teile': [], 'skizzen': []}
                bloecke.append(cur)
            target = el
        for img in target.find_all('img'):
            cur['skizzen'].append(os.path.join(d, img['src']))
            img.decompose()
        # CP-Abschnitte
        for cpp in target.find_all('p', class_='cp'):
            par = cpp.parent
            if par is None:
                continue  # schon mit einem anderen CP-Abschnitt entfernt
            if par is target or 'row' in (par.get('class') or []):
                # CP steht direkt im Block: nur die folgende Liste gehört dazu
                ul = cpp.find_next_sibling('ul')
                items = [text_of(li) for li in ul.find_all('li')] if ul is not None else []
                cur['teile'].append({'art': 'cp', 'zeilen': items, '_pos': POS.get(id(cpp), 10**6)})
                if ul is not None: ul.decompose()
                cpp.decompose()
                continue
            items = [text_of(li) for li in par.find_all('li')]
            extra = [text_of(p) for p in par.find_all('p') if p is not cpp]
            cur['teile'].append({'art': 'cp', 'zeilen': extra + items, '_pos': POS.get(id(par), 10**6)})
            par.decompose()
        for box in target.find_all(class_='box'):
            cur['teile'].append({'art': 'kasten', 'zeilen': [l for l in text_sep(box).split('\n') if l.strip()], '_pos': POS.get(id(box), 10**6)})
            box.decompose()
        for ul in [u for u in target.find_all('ul') if u.find_parent('li') is None]:
            pre = []
            prev = ul.find_previous_sibling('p')
            if prev is not None and prev.parent is ul.parent:
                pre = [text_of(prev)]; prev.decompose()
            cur['teile'].append({'art': 'ablauf', 'zeilen': pre + [li_text(li) for li in ul.find_all('li', recursive=False)], '_pos': POS.get(id(ul), 10**6)})
            ul.decompose()
        rest = text_sep(target)
        if rest:
            cur['teile'].append({'art': 'text', 'zeilen': [l for l in rest.split('\n') if l.strip()], '_pos': POS.get(id(target), 10**6)})

    for b in bloecke:
        b['teile'] = [t for t in b['teile'] if any(z.strip() for z in t['zeilen'])]
        b['teile'].sort(key=lambda t: t['_pos'])
        for t in b['teile']:
            t.pop('_pos', None)
    return {'kopf': kopf, 'sp': sp_t, 'bloecke': bloecke}

if __name__ == '__main__':
    base = sys.argv[1]
    out = []
    for p in sorted(glob.glob(os.path.join(base, '*', 'seite.html')) + glob.glob(os.path.join(base, '*', '*_vorlage.html'))):
        r = parse_page(p); r['ordner'] = os.path.basename(os.path.dirname(p)); out.append(r)
    json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(len(out))

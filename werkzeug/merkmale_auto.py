"""Merkmal-Vorschläge per Stichwort (für alle Übungen ohne Eintrag in der Regeltabelle von karten.py)
und Schwerpunkte einer ganzen Einheit aus ihrer SP-Zeile."""
import re

MP, GB, US, ST = 'Spiel mit dem Ball', 'Spiel gegen den Ball', 'Umschaltspiel', 'Standardsituationen'

# Reihenfolge = Vorrang beim Haupt-Schwerpunkt
SW = [
    ('Torschuss', r'torschuss|abschluss(?!spiel)|torabschluss|schusstechnik|torjäger'),
    ('1 gegen 1 und Zweikampf', r'\b1\s*(gg|gegen|vs\.?)\s*1\b|zweikampf|\bzk\b|duell'),
    ('Umschaltverhalten', r'umschalt|konter|ballverlust'),
    ('Pressing', r'pressing|anlaufen|ballgewinn|\bgegenpress'),
    ('Spieleröffnung', r'spieleröffnung|aufbauspiel|aus der abwehr|herausspielen|\bspielaufbau'),
    ('Spielverlagerung', r'verlagerung|diagonal|seitenwechsel'),
    ('Spiel in die Tiefe', r'in die tiefe|tiefenpass|schnittstelle|steil(pass|e pässe)'),
    ('Korridorspiel', r'korridor'),
    ('Kreieren von Torchancen', r'torchance|durchbruch|flügelspiel|flanke'),
    ('Verteidigen in der Gruppe', r'verteidig|abwehr|defensivverhalten|absichern|staffeln'),
    ('Zusammenspiel', r'über dritte|ü\. ?dritte|doppelpass|steil[- ]?klatsch|klatsch|hinterlauf|kreuzen|anbieten|freilaufen|blank|zusammen-?\)?\s*spiel|kombination|enge[nm]? r[aä]um|rondo|ballbesitz|\b[23]\s*(gg|gegen)\s*[12]\b|überzahl'),
    ('Raumaufteilung', r'raumaufteilung|positionsspiel|breite und tiefe|räume (öffnen|besetzen)'),
    ('Flugbälle', r'flugb[aä]ll|chip|hohe[r]? b[aä]ll|lange bälle'),
    ('Kopfball', r'kopfball'),
    ('Volley', r'volley'),
    ('Finten', r'finte|fintenstern'),
    ('Aufdrehbewegungen', r'aufdreh'),
    ('Dribbling', r'dribbl|technikviereck|technik viereck|ballführung'),
    ('Ballan- und -mitnahme', r'ballan|mitnahme|first[- ]touch|erste[rn]? kontakt|1\. kontakt|ballkontrolle|annahme'),
    ('Ball Mastery', r'ball[- ]?mastery|ballgefühl|jonglier'),
    ('Vororientierung', r'vororientierung|schulterblick|orientierung'),
    ('Passspiel', r'pass|päss|zuspiel'),
    ('Basistechniken allgemein', r'basistechnik|technik'),
    ('Koordination', r'koordination|leiter|lauftechnik|hürde|lauf-?abc|agility'),
    ('Schnelligkeit', r'sprint|schnelligkeit|reaktion|antritt|richtungswechsel|tempo'),
    ('Wahrnehmung und Kognition', r'farben[- ]?spiel|farben[- ]?reaktion|life[- ]?kinetik|wahrnehmung|kognit|handlungsschnell'),
    ('Kraft, Stabilität und Beweglichkeit', r'athletik|kraft|stabi|tabata|workout|hiit|zirkel|core|mobilität|beweglichkeit|dehn'),
]
SW_C = [(n, re.compile(m, re.I)) for n, m in SW]

def schwerpunkte_in(text):
    t = text.replace(' ', ' ')
    return [n for n, m in SW_C if m.search(t)]

def merkmale_auto(titel, form, inhalt, sp_einheit=''):
    tt = schwerpunkte_in(titel)
    ti = schwerpunkte_in(inhalt)
    ts = schwerpunkte_in(sp_einheit)
    h = tt[0] if tt else (ts[0] if ts else (ti[0] if ti else ''))
    weitere = [x for x in dict.fromkeys(tt + ti) if x != h][:3]
    alles = (titel + ' ' + inhalt).lower()
    sp = []
    if form == 'Spielform' or re.search(r'\b\d+\s*(gg|gegen)\s*\d', alles): sp.append(MP)
    if re.search(r'pressing|verteidig|defensiv|ballgewinn|anlaufen|abwehr', alles): sp.append(GB)
    if re.search(r'umschalt|konter', alles): sp.append(US)
    if re.search(r'\becke|freistoß|einwurf|standard', alles): sp = [ST]
    zk = []
    if h == '1 gegen 1 und Zweikampf' or '1 gegen 1 und Zweikampf' in weitere:
        for w, m in (('offensiv', r'offensiv|\boff\b'), ('defensiv', r'defensiv|\bdef\b'), ('frontal', r'frontal'),
                     ('seitlich', r'seitlich'), ('nachrückender Gegenspieler', r'nachrück'), ('Gegner im Rücken', r'im rücken'),
                     ('eindrehende Spitze', r'eindreh')):
            if re.search(m, alles): zk.append(w)
    art = ''
    if form == 'Spielform':
        tl = titel.lower()
        if 'rondo' in tl: art = 'Rondo'
        elif 'chaos' in tl: art = 'Chaos'
        elif re.search(r'turnier|wettkampf|wettbewerb|staffel|handball|spaß|fangen|king of|champions', tl): art = 'Spaß und Wettkampf'
        elif re.search(r'minitor|jugendtor|\btore?\b|linie|endzone|dribbelzone|auf \d+ tore|\+ ?tw', alles): art = 'mit fester Richtung'
        elif re.search(r'ballbesitz|ball halten|ohne tore|positionsspiel', alles): art = 'ohne feste Richtung'
    ort = []
    tl = titel.lower()
    if re.search(r'flügel', tl): ort.append('Flügel')
    if re.search(r'halbraum|\bhr\b', tl): ort.append('Halbraum')
    if re.search(r'zentrum|zentral', tl): ort.append('Zentrum')
    if not (h == '1 gegen 1 und Zweikampf' or re.search(r'\b[123]\s*(gg|gegen)\s*[123]\b', tl)): ort = []
    return dict(sp=sp, h=h, w=weitere, zk=zk, art=art, ort=ort)

// Exportieren: fertige PDFs (Einheit, Schwerpunktliste) weitergeben und ein A4-Blatt für eine Übung erzeugen.
// Am iPhone/Mac öffnet sich das Teilen-Fenster, sonst wird die Datei heruntergeladen.

const JSPDF_URL = 'lib/jspdf.umd.min.js'; // jsPDF 2.5.1 (MIT), liegt in der App
const vorrat = new Map(); // url -> Promise<Blob>
let jspdfLaden = null;

export function pdfHolen(url) {
  if (!vorrat.has(url)) vorrat.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('PDF nicht gefunden'); return r.blob(); }));
  return vorrat.get(url);
}

export function jspdfVorbereiten() {
  if (!jspdfLaden) jspdfLaden = new Promise((ok, fehler) => {
    if (window.jspdf) return ok(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = JSPDF_URL; s.async = true;
    s.onload = () => ok(window.jspdf.jsPDF);
    s.onerror = () => { jspdfLaden = null; fehler(new Error('PDF-Werkzeug konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return jspdfLaden;
}

export function dateiname(text) {
  return String(text).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pdf';
}

export async function teilen(blob, name) {
  const datei = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: name }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Nur Zeichen, die die eingebaute PDF-Schrift kennt (Westeuropäisch).
function sauber(s) {
  return String(s ?? '')
    .replace(/↳/g, '> ').replace(/[→⇒]/g, '->').replace(/[←]/g, '<-').replace(/[↑]/g, '^').replace(/[↓]/g, 'v')
    .replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'")
    .replace(/[^\n\x20-\x7E -ÿ–—•…€]/g, '');
}

function svgAlsBild(url) {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 800, h = img.naturalHeight || 600;
      const f = Math.min(3, 2400 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * f); c.height = Math.round(h * f);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      ok({ daten: c.toDataURL('image/jpeg', 0.85), w, h });
    };
    img.onerror = () => fehler(new Error('Skizze konnte nicht geladen werden'));
    img.src = url;
  });
}

// karte: { titel, herkunft, merkmale: [[name, wert]], skizzen: [url], teile: [{art, zeilen}] }
export async function uebungAlsPdf(karte) {
  const JsPDF = await jspdfVorbereiten();
  const bilder = [];
  for (const s of karte.skizzen || []) { try { bilder.push(await svgAlsBild(s)); } catch (e) { /* Skizze fehlt: ohne weiter */ } }

  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const L = 18, B = 210 - 2 * L, UNTEN = 280;
  let y = 22;
  const platz = h => { if (y + h > UNTEN) { doc.addPage(); y = 20; } };
  const text = (t, groesse, stil = 'normal', farbe = 0, abstand = 0.45) => {
    doc.setFont('helvetica', stil); doc.setFontSize(groesse); doc.setTextColor(farbe);
    const zeilen = doc.splitTextToSize(sauber(t), B);
    const zh = groesse * abstand;
    zeilen.forEach(z => { platz(zh); doc.text(z, L, y); y += zh; });
  };

  text(karte.titel, 18, 'bold', 0, 0.42);
  y += 1;
  if (karte.herkunft) text(karte.herkunft, 9, 'normal', 90);
  y += 4;

  // Merkmale in zwei Spalten
  const m = (karte.merkmale || []).filter(z => z[1]);
  if (m.length) {
    const sp = B / 2;
    doc.setDrawColor(221, 227, 238);
    const start = y;
    y += 5;
    for (let i = 0; i < m.length; i += 2) {
      let h = 0;
      [m[i], m[i + 1]].forEach((z, k) => {
        if (!z) return;
        const x = L + 4 + k * sp;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
        doc.text(sauber(z[0]), x, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0);
        const w = doc.splitTextToSize(sauber(z[1]), sp - 8);
        doc.text(w, x, y + 4);
        h = Math.max(h, 4 + w.length * 4.2);
      });
      y += h + 2;
    }
    doc.roundedRect(L, start, B, y - start - 1, 2, 2);
    y += 4;
  }

  // Skizzen
  const maxH = bilder.length > 1 ? 85 : 115;
  for (const b of bilder) {
    let w = B, h = B * b.h / b.w;
    if (h > maxH) { h = maxH; w = h * b.w / b.h; }
    const frei = UNTEN - y - 4;
    if (h > frei && frei >= 55) { h = frei; w = h * b.w / b.h; }
    platz(h + 4);
    doc.addImage(b.daten, 'JPEG', L + (B - w) / 2, y, w, h);
    y += h + 6;
  }

  // Ablauf, Coachingpunkte, Kästen
  for (const t of karte.teile || []) {
    const z = (t.zeilen || []).filter(x => !/^CP:?$/.test(x));
    if (!z.length) continue;
    const ueber = t.art === 'cp' ? 'Coachingpunkte' : t.art === 'ablauf' ? 'Ablauf' : '';
    platz(12);
    if (ueber) { text(ueber, 11, 'bold'); y += 1; }
    const liste = t.art === 'cp' || t.art === 'ablauf';
    z.forEach(x => text((liste ? '• ' : '') + x, 10, 'normal', 0, 0.48));
    y += 4;
  }

  // Fußzeile auf jeder Seite
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(221, 227, 238); doc.line(L, 286, L + B, 286);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text('Trainingsbibliothek', L, 290);
    doc.text(`Exportiert am ${heute}${n > 1 ? ` · Seite ${i}/${n}` : ''}`, L + B, 290, { align: 'right' });
  }
  return doc.output('blob');
}

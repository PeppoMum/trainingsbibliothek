// Grundbestand: aufgenommene Einträge vollständig, alle anderen nur als Kurzform (Kennung, Status, Ziel),
// damit die Datei klein bleibt (Vorschläge und Papierkorb lädt nur Phil nach der Anmeldung).
export function standAus(einheiten, uebungen, zeit) {
  const kurz = d => ({ id: d.id, status: d.status, ...(d.ziel ? { ziel: d.ziel } : {}) });
  const voll = d => { const { geaendert, ...rest } = d; return rest; };
  const nachId = (a, b) => a.id.localeCompare(b.id);
  return {
    zeit,
    einheiten: einheiten.map(d => d.status === 'aufgenommen' ? voll(d) : kurz(d)).sort(nachId),
    uebungen: uebungen.map(d => d.status === 'aufgenommen' ? voll(d) : kurz(d)).sort(nachId),
  };
}

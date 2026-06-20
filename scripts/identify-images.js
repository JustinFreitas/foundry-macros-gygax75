/**
 * Identify the 3 documents whose uploaded images are missing.
 */
(() => {
  const out = [];

  const itemIds = ["Z3J2MkBDaj1CNSSk", "IhsfhigozMbtzyK0"];
  for (const id of itemIds) {
    let doc = game.items.get(id), where = "World item";
    if (!doc) { // maybe an owned item on an actor
      for (const a of game.actors) { const i = a.items.get(id); if (i) { doc = i; where = `Item on actor "${a.name}"`; break; } }
    }
    if (doc) out.push({
      What: where, Name: doc.name, Type: doc.type ?? "—",
      Folder: doc.folder?.name ?? (doc.parent?.name ? `(on ${doc.parent.name})` : "—"),
      Img: doc.img, ID: id
    });
    else out.push({ What: "Item NOT FOUND", Name: "?", Type: "—", Folder: "—", Img: "—", ID: id });
  }

  // Journal page
  const j = game.journal.get("tejwXtka1HlLCeGn");
  const p = j?.pages.get("3xvmG0TSQVBi2P9k");
  if (p) out.push({
    What: `Journal page in "${j.name}"`, Name: p.name, Type: p.type,
    Folder: j.folder?.name ?? "—", Img: p.src ?? "(in text)", ID: p.id
  });
  else out.push({ What: "Journal page NOT FOUND", Name: "?", Type: "—", Folder: j?.name ?? "?", Img: "—", ID: "3xvmG0TSQVBi2P9k" });

  console.table(out);
  // Also open each sheet so you can see them visually:
  game.items.get("Z3J2MkBDaj1CNSSk")?.sheet.render(true);
  game.items.get("IhsfhigozMbtzyK0")?.sheet.render(true);
  j?.sheet.render(true);
})();

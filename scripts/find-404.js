/**
 * Find documents referencing missing "forge-migration" image paths.
 * Reports actor/item/scene/token/tile/journal/etc. that point at the broken assets.
 */
(async () => {
  // Edit this if you want to search for a different fragment:
  const NEEDLE = "forge-migration";

  const hits = [];

  const record = (where, id, name, field, path, doc) => {
    if (typeof path === "string" && path.includes(NEEDLE)) {
      hits.push({ where, id, name, field, path, doc });
    }
  };

  // --- World actors (+ their prototype tokens & owned items) ---
  for (const a of game.actors) {
    record("Actor", a.id, a.name, "img", a.img, a);
    record("Actor", a.id, a.name, "prototypeToken.texture", a.prototypeToken?.texture?.src, a);
    for (const i of a.items) record(`Item (on ${a.name})`, i.id, i.name, "img", i.img, i);
  }

  // --- World items ---
  for (const i of game.items) record("Item", i.id, i.name, "img", i.img, i);

  // --- Scenes: background, foreground, tokens, tiles, notes ---
  for (const s of game.scenes) {
    record("Scene", s.id, s.name, "background.src", s.background?.src, s);
    record("Scene", s.id, s.name, "foreground", s.foreground, s);
    for (const t of s.tokens) record(`Token (on ${s.name})`, t.id, t.name, "texture.src", t.texture?.src, t);
    for (const t of s.tiles) record(`Tile (on ${s.name})`, t.id, "(tile)", "texture.src", t.texture?.src, t);
    for (const n of s.notes) record(`Note (on ${s.name})`, n.id, "(note)", "texture.src", n.texture?.src, n);
  }

  // --- Journal entries & their pages (image pages / text with embedded imgs) ---
  for (const j of game.journal) {
    for (const p of j.pages) {
      record(`Journal "${j.name}"`, p.id, p.name, "src", p.src, j);
      record(`Journal "${j.name}"`, p.id, p.name, "text.content", p.text?.content, j);
    }
  }

  // --- Other commonly-imaged collections ---
  for (const m of game.macros)   record("Macro", m.id, m.name, "img", m.img, m);
  for (const r of game.tables)   record("RollTable", r.id, r.name, "img", r.img, r);
  for (const p of game.playlists) record("Playlist", p.id, p.name, "img", p.img, p);
  for (const u of game.users)    record("User", u.id, u.name, "avatar", u.avatar, u);

  // --- Report ---
  if (!hits.length) {
    ui.notifications.info(`No documents reference "${NEEDLE}".`);
    console.log(`[forge-migration scan] No hits.`);
    return;
  }

  console.groupCollapsed(`[forge-migration scan] ${hits.length} reference(s) found`);
  console.table(hits.map(h => ({ Type: h.where, Name: h.name, Field: h.field, Path: h.path, ID: h.id })));
  console.log("Full objects (click to inspect / .sheet?.render(true)):", hits);
  console.groupEnd();

  const rows = hits.map(h =>
    `<li><b>${h.where}</b> — <i>${h.name}</i> <code>[${h.field}]</code><br><small>${h.path}</small></li>`
  ).join("");

  const { DialogV2 } = foundry.applications.api;
  DialogV2.wait({
    window: { title: `Found ${hits.length} "${NEEDLE}" reference(s)` },
    position: { width: 600 },
    content: `<p>These documents point at the broken path. Details also logged to the console (F12).</p><ul>${rows}</ul>`,
    buttons: [ { action: "ok", label: "Close", default: true } ]
  });
})();

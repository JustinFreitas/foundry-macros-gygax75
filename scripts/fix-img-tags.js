/**
 * Strip dead embedded <img> tags from item descriptions & journal text pages.
 * - Only removes <img> whose src contains "forge-migration" AND truly 404s.
 * - Replaces the tag with <!-- broken-image removed: <src> --> (recoverable).
 * - DRY_RUN: true = preview only; set to false to apply.
 */
(async () => {
  const DRY_RUN = true;          // <-- set to false to actually apply
  const NEEDLE  = "forge-migration";

  const log = [];

  const isDead = async (src) => {
    try {
      const url = encodeURI(src.replace(/&amp;/g, "&"));
      let r = await fetch(url, { method: "HEAD" });
      if (r.status === 405 || r.status === 501) r = await fetch(url, { method: "GET" });
      return !r.ok;
    } catch { return true; }
  };

  // Returns cleaned HTML if anything changed, else null
  const clean = async (html, label) => {
    if (typeof html !== "string" || !html.includes("<img")) return null;
    let result = html, changed = false;
    for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
      const src = tag.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!src || (NEEDLE && !src.includes(NEEDLE))) continue;
      if (await isDead(src)) {
        result = result.replace(tag, `<!-- broken-image removed: ${src} -->`);
        changed = true;
        log.push({ where: label, src });
      }
    }
    return changed ? result : null;
  };

  // --- World items (OSE stores rich text in system.description) ---
  const itemUpdates = [];
  for (const it of game.items) {
    const cleaned = await clean(foundry.utils.getProperty(it, "system.description"), `Item "${it.name}"`);
    if (cleaned !== null) itemUpdates.push({ _id: it.id, "system.description": cleaned });
  }

  // --- Owned items on actors ---
  const actorItemUpdates = new Map();
  for (const a of game.actors) {
    const ups = [];
    for (const it of a.items) {
      const cleaned = await clean(foundry.utils.getProperty(it, "system.description"), `Item "${it.name}" on ${a.name}`);
      if (cleaned !== null) ups.push({ _id: it.id, "system.description": cleaned });
    }
    if (ups.length) actorItemUpdates.set(a, ups);
  }

  // --- Journal text pages ---
  const journalUpdates = new Map();
  for (const j of game.journal) {
    const ups = [];
    for (const p of j.pages) {
      const cleaned = await clean(foundry.utils.getProperty(p, "text.content"), `Journal "${j.name}" → "${p.name}"`);
      if (cleaned !== null) ups.push({ _id: p.id, "text.content": cleaned });
    }
    if (ups.length) journalUpdates.set(j, ups);
  }

  // --- Report ---
  console.group(`%c[img cleanup] ${DRY_RUN ? "DRY RUN — nothing written" : "APPLYING CHANGES"}`,
    `font-weight:bold;color:${DRY_RUN ? "#fc6" : "#6f6"}`);
  console.table(log);
  console.groupEnd();

  if (DRY_RUN) {
    ui.notifications.info(`Dry run: ${log.length} dead image(s) would be removed. Set DRY_RUN=false to apply.`);
    return;
  }

  // --- Apply ---
  if (itemUpdates.length) await Item.updateDocuments(itemUpdates);
  for (const [a, ups] of actorItemUpdates) await a.updateEmbeddedDocuments("Item", ups);
  for (const [j, ups] of journalUpdates) await j.updateEmbeddedDocuments("JournalEntryPage", ups);

  ui.notifications.info(`Removed ${log.length} dead embedded image(s). Reload (F5) to confirm.`);
})();

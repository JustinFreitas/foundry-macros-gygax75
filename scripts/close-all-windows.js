// Close all journal/actor/item sheets.
Object.values(ui.windows).forEach(w => w.close());

// Close all tables.
ui.tables.collection.forEach(t=>t.sheet.close());

// Close all macros.
ui.macros.collection.forEach(m=>m.sheet.close());

// Close all journals.
ui.journal.collection.forEach(j=>j.sheet.close());

// CLose all popouts from sidebar.
ui.chat.popout?.close();
ui.combat.popout?.close();
ui.scenes.popout?.close();
ui.actors.popout?.close();
ui.items.popout?.close();
ui.journal.popout?.close();
ui.tables.popout?.close();
ui.cards.popout?.close();
ui.macros.popout?.close();
ui.playlists.popout?.close();
ui.compendium.popout?.close();
ui.settings.popout?.close();

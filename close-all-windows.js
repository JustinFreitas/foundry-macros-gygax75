// Close all journal/actor/item sheets.
Object.values(ui.windows).forEach(w => w.close());

// Close all tables.
ui.tables.collection.forEach(t=>t.sheet.close());

// Close all macros.
ui.macros.collection.forEach(m=>m.sheet.close());

// Close all journals.
ui.journal.collection.forEach(j=>j.sheet.close());

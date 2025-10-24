const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/close-all-windows.js'), 'utf8');

global.ui = {
    windows: {},
    tables: { collection: { forEach: jest.fn() } },
    macros: { collection: { forEach: jest.fn() } },
    journal: { collection: { forEach: jest.fn() } },
    chat: { popout: { close: jest.fn() } },
    combat: { popout: { close: jest.fn() } },
    scenes: { popout: { close: jest.fn() } },
    actors: { popout: { close: jest.fn() } },
    items: { popout: { close: jest.fn() } },
    cards: { popout: { close: jest.fn() } },
    playlists: { popout: { close: jest.fn() } },
    compendium: { popout: { close: jest.fn() } },
    settings: { popout: { close: jest.fn() } },
};

describe("Close All Windows Macro", () => {

    beforeEach(() => {
        global.ui = {
            windows: {
                1: { close: jest.fn() },
                2: { close: jest.fn() },
            },
            tables: { collection: { forEach: jest.fn(callback => [ { sheet: { close: jest.fn() } } ].forEach(callback)) } },
            macros: { collection: { forEach: jest.fn(callback => [ { sheet: { close: jest.fn() } } ].forEach(callback)) } },
            journal: { collection: { forEach: jest.fn(callback => [ { sheet: { close: jest.fn() } } ].forEach(callback)) } },
            chat: { popout: { close: jest.fn() } },
            combat: { popout: { close: jest.fn() } },
            scenes: { popout: { close: jest.fn() } },
            actors: { popout: { close: jest.fn() } },
            items: { popout: { close: jest.fn() } },
            cards: { popout: { close: jest.fn() } },
            playlists: { popout: { close: jest.fn() } },
            compendium: { popout: { close: jest.fn() } },
            settings: { popout: { close: jest.fn() } },
        };
    });

    test("should close all windows", () => {
        eval(macroScript);

        expect(ui.windows[1].close).toHaveBeenCalled();
        expect(ui.windows[2].close).toHaveBeenCalled();
        expect(ui.tables.collection.forEach).toHaveBeenCalled();
        expect(ui.macros.collection.forEach).toHaveBeenCalled();
        expect(ui.journal.collection.forEach).toHaveBeenCalled();
        expect(ui.chat.popout.close).toHaveBeenCalled();
        expect(ui.combat.popout.close).toHaveBeenCalled();
        expect(ui.scenes.popout.close).toHaveBeenCalled();
        expect(ui.actors.popout.close).toHaveBeenCalled();
        expect(ui.items.popout.close).toHaveBeenCalled();
        expect(ui.cards.popout.close).toHaveBeenCalled();
        expect(ui.playlists.popout.close).toHaveBeenCalled();
        expect(ui.compendium.popout.close).toHaveBeenCalled();
        expect(ui.settings.popout.close).toHaveBeenCalled();
    });
});

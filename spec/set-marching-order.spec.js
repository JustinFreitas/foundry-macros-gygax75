global.foundry = { applications: { api: { DialogV2: {} } } };
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/set-marching-order.js'), 'utf8');

global.game = {
    actors: {
        filter: jest.fn(),
        get: jest.fn()
    }
};

global.ui = {
    notifications: {
        warn: jest.fn(),
        info: jest.fn()
    }
};

global.foundry.applications.api.DialogV2.wait = global.Dialog = jest.fn(function (dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});

// Render the dialog's HTML string into a real (jsdom) container and return a
// jQuery-ish wrapper where wrapper[0] is that container, matching how the macro
// accesses `html[0]`.
function mountDialogContent(content) {
    const container = document.createElement("div");
    container.innerHTML = content;
    document.body.appendChild(container);
    return [container];
}

describe("Set Marching Order Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = "";
    });

    test("should warn if no actors are in the party", () => {
        game.actors.filter.mockReturnValue([]);
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith("There are no characters currently in your OSE Party Sheet!");
        expect(Dialog).not.toHaveBeenCalled();
    });

    test("should render rows pre-sorted by current marching order, unset last", () => {
        const actors = [
            { id: 'a2', name: 'Hero 2', flags: { ose: { marchingOrder: 2, party: true } } },
            { id: 'a1', name: 'Hero 1', flags: { ose: { marchingOrder: 1, party: true } } },
            { id: 'a3', name: 'Hero 3', flags: { ose: { party: true } } } // unset -> 999 -> last
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);

        const content = Dialog.mock.calls[0][0].content;
        const html = mountDialogContent(content);
        const ids = [...html[0].querySelectorAll(".mo-row")].map(r => r.dataset.actorId);
        expect(ids).toEqual(['a1', 'a2', 'a3']);
    });

    test("render() numbers the rows 1..N", () => {
        const actors = [
            { id: 'a1', name: 'Hero 1', flags: { ose: { marchingOrder: 1, party: true } } },
            { id: 'a2', name: 'Hero 2', flags: { ose: { marchingOrder: 2, party: true } } }
        ];
        game.actors.filter.mockReturnValue(actors);
        eval(macroScript);

        const dialog = Dialog.mock.calls[0][0];
        const html = mountDialogContent(dialog.content);
        if(html[0] && !html[0].querySelector) html[0].querySelector = sel => { const el = html.find(sel); return el && el.length ? el[0] : null; };
dialog.render(null, html[0]);

        const ranks = [...html[0].querySelectorAll(".mo-rank")].map(s => s.textContent);
        expect(ranks).toEqual(['1.', '2.']);
    });

    test("save writes 1..N in the CURRENT DOM order (drag result), not the input order", async () => {
        const a1 = { id: 'a1', name: 'Hero 1', flags: { ose: { party: true } }, setFlag: jest.fn() };
        const a2 = { id: 'a2', name: 'Hero 2', flags: { ose: { party: true } }, setFlag: jest.fn() };
        const a3 = { id: 'a3', name: 'Hero 3', flags: { ose: { party: true } }, setFlag: jest.fn() };
        game.actors.filter.mockReturnValue([a1, a2, a3]);
        game.actors.get.mockImplementation(id => ({ a1, a2, a3 }[id]));

        eval(macroScript);
        const dialog = Dialog.mock.calls[0][0];
        const html = mountDialogContent(dialog.content);

        // Simulate a drag that moves Hero 3 to the top: a3, a1, a2.
        const list = html[0].querySelector("#mo-list");
        const row3 = list.querySelector('[data-actor-id="a3"]');
        list.insertBefore(row3, list.firstChild);

        await dialog.buttons.find(b => b.action === 'save').callback(null, null, { element: html[0] });

        expect(a3.setFlag).toHaveBeenCalledWith("ose", "marchingOrder", 1);
        expect(a1.setFlag).toHaveBeenCalledWith("ose", "marchingOrder", 2);
        expect(a2.setFlag).toHaveBeenCalledWith("ose", "marchingOrder", 3);
        expect(ui.notifications.info).toHaveBeenCalledWith("Marching order saved.");
    });

    test("save assigns contiguous 1..N orders (no gaps or duplicates possible)", async () => {
        const made = ['a1', 'a2', 'a3', 'a4'].map(id => ({
            id, name: id, flags: { ose: { party: true } }, setFlag: jest.fn()
        }));
        game.actors.filter.mockReturnValue(made);
        game.actors.get.mockImplementation(id => made.find(a => a.id === id));

        eval(macroScript);
        const dialog = Dialog.mock.calls[0][0];
        const html = mountDialogContent(dialog.content);
        await dialog.buttons.find(b => b.action === 'save').callback(null, null, { element: html[0] });

        const assigned = made.map(a => a.setFlag.mock.calls[0][2]).sort((x, y) => x - y);
        expect(assigned).toEqual([1, 2, 3, 4]);
    });
});

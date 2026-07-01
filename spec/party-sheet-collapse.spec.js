const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/party-sheet-collapse.js'), 'utf8');

const GRID = 100;

global.canvas = {
    grid: { size: GRID },
    tokens: { placeables: [] },
    scene: {
        createEmbeddedDocuments: jest.fn(),
        deleteEmbeddedDocuments: jest.fn()
    }
};

global.game = {
    actors: {
        getName: jest.fn(),
        filter: jest.fn(),
        get: jest.fn()
    }
};

global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };

global.$ = (x) => x;
global.foundry = { applications: { api: { DialogV2: {} } } };
global.foundry.applications.api.DialogV2.wait = global.Dialog = jest.fn(function (dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});

// A party-sheet character actor.
function charActor(id, marchingOrder) {
    const ose = { party: true };
    if (marchingOrder !== undefined) ose.marchingOrder = marchingOrder;
    return { id, name: id, type: 'character', flags: { ose } };
}

// A token on the scene for a given actor at grid cell (gx, gy).
function tokenFor(actor, gx, gy) {
    return { id: `tok-${actor.id}`, actor, document: { x: gx * GRID, y: gy * GRID } };
}

// The "Party" actor with a prototype token.
const partyActor = {
    id: 'party-actor',
    name: 'Party',
    prototypeToken: { toObject: () => ({ name: 'Party' }) }
};

// Wire up the mocks for a given set of character actors + their tokens.
function setup(charActors, tokens) {
    game.actors.getName.mockImplementation(name => (name === 'Party' ? partyActor : null));
    game.actors.filter.mockReturnValue(charActors);
    game.actors.get.mockImplementation(id => charActors.find(a => a.id === id));
    canvas.tokens.placeables = tokens;
}

// Run a chosen direction button with a chosen size ("1" or "2").
async function run(direction, size) {
    const html = { find: jest.fn().mockReturnValue([{ value: size }]) };
    await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === direction).callback(null, null, { element: html });
}

function createdToken() {
    return canvas.scene.createEmbeddedDocuments.mock.calls[0][1][0];
}

describe("Party Sheet Collapse Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        canvas.tokens.placeables = [];
    });

    test("warns if no Party actor exists", () => {
        game.actors.getName.mockReturnValue(null);
        game.actors.filter.mockReturnValue([]);
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith(
            'No actor named "Party" was found to create the Party token.'
        );
        expect(Dialog).not.toHaveBeenCalled();
    });

    test("warns if no party-character tokens are on the scene", () => {
        setup([charActor('a1', 1)], []); // actor exists but no tokens placed
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith(
            "No party-character tokens were found on this scene to collapse."
        );
        expect(Dialog).not.toHaveBeenCalled();
    });

    test("5' (1x1) token anchors directly on the rank-1 leader", async () => {
        const a1 = charActor('a1', 1);
        const a2 = charActor('a2', 2);
        // Leader (a1) at (5,5); a2 trailing south at (5,6).
        const tokens = [tokenFor(a1, 5, 5), tokenFor(a2, 5, 6)];
        setup([a1, a2], tokens);

        eval(macroScript);
        await run('north', '1');

        const created = createdToken();
        expect(created.width).toBe(1);
        expect(created.height).toBe(1);
        expect(created.x).toBe(500);
        expect(created.y).toBe(500);
        expect(created.actorId).toBe('party-actor');
    });

    test("10' (2x2) token puts its upper-left on the leader when facing north", async () => {
        const a1 = charActor('a1', 1);
        const a2 = charActor('a2', 2);
        const tokens = [tokenFor(a1, 5, 5), tokenFor(a2, 5, 6)];
        setup([a1, a2], tokens);

        eval(macroScript);
        await run('north', '2');

        const created = createdToken();
        expect(created.width).toBe(2);
        expect(created.height).toBe(2);
        // North anchor = top-left, so top-left == leader cell (5,5).
        expect(created.x).toBe(500);
        expect(created.y).toBe(500);
    });

    test("10' anchor corner inverts the deploy anchor for every direction", async () => {
        // Leader fixed at (5,5). For a 2x2 token, top-left must shift so the
        // direction's anchor corner lands on (5,5):
        //   north -> top-left (5,5); south -> bottom-right => top-left (4,4)
        //   east  -> top-right (4,5); west -> bottom-left  => top-left (5,4)
        const cases = {
            north: [500, 500],
            south: [400, 400],
            east:  [400, 500],
            west:  [500, 400]
        };

        for (const [dir, [x, y]] of Object.entries(cases)) {
            jest.clearAllMocks();
            const a1 = charActor('a1', 1);
            setup([a1], [tokenFor(a1, 5, 5)]);
            eval(macroScript);
            await run(dir, '2');
            const created = createdToken();
            expect([created.x, created.y]).toEqual([x, y]);
        }
    });

    test("deletes all member tokens and creates exactly one Party token", async () => {
        const a1 = charActor('a1', 1);
        const a2 = charActor('a2', 2);
        const a3 = charActor('a3', 3);
        const tokens = [tokenFor(a1, 5, 5), tokenFor(a2, 5, 6), tokenFor(a3, 5, 7)];
        setup([a1, a2, a3], tokens);

        eval(macroScript);
        await run('north', '1');

        // One token created...
        expect(canvas.scene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
        expect(canvas.scene.createEmbeddedDocuments.mock.calls[0][1]).toHaveLength(1);
        // ...and all three member tokens deleted by id.
        expect(canvas.scene.deleteEmbeddedDocuments).toHaveBeenCalledWith(
            "Token", ['tok-a1', 'tok-a2', 'tok-a3']
        );
        expect(ui.notifications.info).toHaveBeenCalledWith(
            "Collapsed 3 party tokens into the Party token."
        );
    });

    test("uses the lowest marching order (ties by id) as the leader, regardless of token order", async () => {
        const a1 = charActor('a1', 3);
        const a2 = charActor('a2', 1); // lowest order -> leader
        const a3 = charActor('a3', 2);
        // Tokens listed out of order; leader a2 sits at (9,9).
        const tokens = [tokenFor(a1, 5, 5), tokenFor(a3, 7, 7), tokenFor(a2, 9, 9)];
        setup([a1, a2, a3], tokens);

        eval(macroScript);
        await run('north', '1');

        const created = createdToken();
        expect(created.x).toBe(900);
        expect(created.y).toBe(900);
    });
});

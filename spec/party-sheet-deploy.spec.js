const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/party-sheet-deploy.js'), 'utf8');

global.canvas = {
    tokens: {
        controlled: []
    },
    grid: {
        size: 100
    },
    scene: {
        createEmbeddedDocuments: jest.fn()
    },
    regions: {
        placeables: []
    }
};

global.CONFIG = {
    Canvas: {
        polygonBackends: {
            move: {
                testCollision: jest.fn(() => false)
            }
        }
    }
};

global.game = {
    actors: {
        filter: jest.fn()
    }
};

global.ui = {
    notifications: {
        warn: jest.fn(),
        info: jest.fn()
    }
};

global.$ = (x) => x;
global.Dialog = jest.fn().mockImplementation(function(dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});
global.Dialog.wait = global.Dialog;
global.foundry = { applications: { api: { DialogV2: global.Dialog } } };

// Build a token actor stub with the given id/name.
function actor(id) {
    return {
        id,
        name: id,
        type: 'character',
        flags: { ose: { party: true } },
        prototypeToken: { toObject: () => ({ name: id }) }
    };
}

// Convert a pixel center (gridScale 100) back to integer grid coords.
function cellOf(center) {
    return { gx: Math.floor(center.x / 100), gy: Math.floor(center.y / 100) };
}

// Mock testCollision so that travel between any unordered pair of adjacent
// cells listed in `blocked` (each entry [[gx,gy],[gx,gy]]) is walled off.
function blockEdges(blocked) {
    const set = new Set();
    for (const [a, b] of blocked) {
        set.add(`${a[0]},${a[1]}->${b[0]},${b[1]}`);
        set.add(`${b[0]},${b[1]}->${a[0]},${a[1]}`);
    }
    global.CONFIG.Canvas.polygonBackends.move.testCollision.mockImplementation((pC, nC) => {
        const p = cellOf(pC);
        const n = cellOf(nC);
        return set.has(`${p.gx},${p.gy}->${n.gx},${n.gy}`);
    });
}

// Set of "x,y" pixel coords from a createEmbeddedDocuments call, for order-free
// membership assertions.
function placedCoords() {
    const created = global.canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
    return created.map(t => `${t.x},${t.y}`);
}

describe("Party Sheet Deploy Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.canvas.tokens.controlled = [];
        global.canvas.regions.placeables = [];
        global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(false);
    });

    test("should warn if no token is selected", () => {
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith("Please select the Party Token first!");
    });

    test("should show direction picker and deploy sequentially with cardinal flow", async () => {
        const deleteMock = jest.fn();
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: deleteMock },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        
        const actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);

        expect(Dialog).toHaveBeenCalled();
        const dialogData = Dialog.mock.calls[0][0];
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };

        // Simulate clicking 'North'
        await dialogData.buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });
        
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        // H1 in footprint (500,500)
        // H2 should fill Rank 0 (Side-by-side) -> (600,500)
        expect(created[0].x).toBe(500); expect(created[0].y).toBe(500);
        expect(created[1].x).toBe(600); expect(created[1].y).toBe(500);
        expect(deleteMock).toHaveBeenCalled();
    });

    test("should force single file contiguously", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        
        const actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } },
            { id: 'a3', name: 'H3', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H3' }) } }
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: true }]) };
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        // Single file North facing: (500,500) -> (500,600) -> (500,700)
        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toEqual([
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 }),
            expect.objectContaining({ x: 500, y: 700 })
        ]);
    });

    test("multi-cell party token anchors at the front/lowest-lane footprint corner", async () => {
        // 2x2 token at (500,500). Facing East, the anchor is the frontmost (east),
        // lowest-lane (north) corner = (600,500). Double file then partners south.
        const leader = {
            document: { x: 500, y: 500, width: 2, height: 2, delete: jest.fn() },
            center: { x: 600, y: 600 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue([actor('a1'), actor('a2')]);

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "east").callback(null, null, { element: mockHtml });

        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(2);
        expect(created[0].x).toBe(600); expect(created[0].y).toBe(500);
        expect(created[1].x).toBe(600); expect(created[1].y).toBe(600);
    });

    test("a 2x2 party token deploys identically to a 1x1 at its top-left corner (north)", async () => {
        // Same 6-actor double-file north layout must come out whether the party
        // token is 1x1 at (500,500) or 2x2 occupying (500,500)..(600,600): the
        // 2x2 anchors at its top-left corner (500,500) and ignores its bulk.
        const run = async (width, height) => {
            jest.clearAllMocks();
            global.canvas.tokens.controlled = [{
                document: { x: 500, y: 500, width, height, delete: jest.fn() },
                center: { x: 500 + width * 50, y: 500 + height * 50 }
            }];
            global.canvas.regions.placeables = [];
            global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(false);
            game.actors.filter.mockReturnValue(
                ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(actor)
            );
            eval(macroScript);
            const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };
            await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });
            return placedCoords();
        };

        const oneByOne = await run(1, 1);
        const twoByTwo = await run(2, 2);
        expect(twoByTwo).toEqual(oneByOne);
        // And concretely: the tidy 2x3 block anchored at the top-left corner.
        expect(twoByTwo).toEqual([
            '500,500', '600,500',
            '500,600', '600,600',
            '500,700', '600,700'
        ]);
    });

    // --- Wall-honoring flow -------------------------------------------------

    test("double file completes the rank, then steps back on the unwalled lane", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue([actor('a1'), actor('a2'), actor('a3')]);

        // Leader at grid (5,5), facing North. Wall the edge straight back to (5,6).
        blockEdges([[[5, 5], [5, 6]]]);

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) }; // double file
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        const coords = placedCoords();
        expect(coords).toHaveLength(3);
        // Nobody crosses the wall straight back from the leader.
        expect(coords).not.toContain('500,600');
        // Serpentine: fill the rank partner (600,500), then resume "backward" on
        // the lane that ISN'T walled off -> (600,600).
        expect(coords).toEqual(['500,500', '600,500', '600,600']);
    });

    test("double file in a 1-wide L-corridor degrades to single file around the bend", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue([actor('a1'), actor('a2'), actor('a3'), actor('a4')]);

        // 1-cell-wide corridor: straight south two cells, then it turns east.
        // Double file is requested, but the corridor never admits a partner, so
        // the trail correctly runs single-wide and rounds the corner.
        //   (5,5) leader
        //   (5,6)
        //   (5,7) (6,7) (7,7)   <- the bend runs east
        const corridor = new Set(['5,5', '5,6', '5,7', '6,7', '7,7']);
        global.canvas.regions.placeables = [{
            testPoint: (c) => corridor.has(`${Math.floor(c.x / 100)},${Math.floor(c.y / 100)}`)
        }];

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) }; // double file
        // Facing North => "back" runs +y, i.e. down the corridor and around the bend.
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        const coords = placedCoords();
        // Exact path order, strictly one wide, rounding the corner.
        expect(coords).toEqual(['500,500', '500,600', '500,700', '600,700']);
    });

    test("double file rounds a 2-wide corner via the partner lane (no premature dead-end)", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue(
            ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map(actor)
        );

        // A genuinely 2-wide L. Vertical leg (cols 5-6, rows 5-7) turns into a
        // horizontal leg (cols 7-8, rows 7-8). Facing north, the trail runs south
        // down the vertical leg; south is then blocked (no row 8 under cols 5-6),
        // so it must turn EAST around the bend. The eastern turn is only reachable
        // from (6,7) — the PARTNER cell of the last vertical rank — so this
        // exercises the corner-via-partner path that a lead-cell-only turn misses.
        const room = new Set([
            '5,5', '6,5',
            '5,6', '6,6',
            '5,7', '6,7', '7,7', '8,7',
            '7,8', '8,8'
        ]);
        global.canvas.regions.placeables = [{
            testPoint: (c) => room.has(`${Math.floor(c.x / 100)},${Math.floor(c.y / 100)}`)
        }];

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) }; // double file
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        const coords = placedCoords();
        // All eight must be seated within the room — none dropped, none leaked.
        expect(coords).toHaveLength(8);
        for (const c of coords) {
            const [x, y] = c.split(',').map(Number);
            expect(room.has(`${x / 100},${y / 100}`)).toBe(true);
        }
        // The first three ranks fill the vertical leg two-abreast...
        expect(new Set(coords.slice(0, 6))).toEqual(new Set([
            '500,500', '600,500', '500,600', '600,600', '500,700', '600,700'
        ]));
        // ...then the trail rounds the corner east rather than dead-ending,
        // continuing along the horizontal leg.
        expect(coords.slice(6)).toEqual(['700,700', '800,700']);
    });

    test("double file forms a contiguous two-wide column in open space (serpentine fill)", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue(
            ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(actor)
        );

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) }; // double file
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        const coords = placedCoords();
        // Each rank is filled two-abreast before stepping back: a tidy 2x3 block
        // behind the leader. (The fill ORDER serpentines, but the final block is
        // a clean marching column.)
        expect(new Set(coords)).toEqual(new Set([
            '500,500', '600,500', // rank 0
            '500,600', '600,600', // rank 1
            '500,700', '600,700'  // rank 2
        ]));
        // And no rank is ever skipped / no token floats off on its own.
        expect(coords).toHaveLength(6);
    });

    test("single-file trail follows an L-shaped corridor around the bend", async () => {
        // Leader at grid (5,5), party heading WEST -> leader is westmost and the
        // single-file trail extends EAST behind it down the corridor. At column 9
        // the corridor turns NORTH, so the footsteps follow it: straight east to
        // the corner, then straight north up the new leg. The trail keeps going
        // straight in its current heading and only turns where the corridor does.
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue(
            ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'].map(actor)
        );

        // L-shaped corridor region: row y=5 from x=5..9, then column x=9 going up
        // (y=4,3,2,1). One cell wide throughout.
        const corridor = new Set([
            '5,5', '6,5', '7,5', '8,5', '9,5', // east leg
            '9,4', '9,3', '9,2', '9,1'         // north leg
        ]);
        global.canvas.regions.placeables = [{
            testPoint: (c) => corridor.has(`${Math.floor(c.x / 100)},${Math.floor(c.y / 100)}`)
        }];

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: true }]) }; // single file
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "west").callback(null, null, { element: mockHtml });

        const coords = placedCoords();
        // Exactly one token per corridor cell, in path order: east leg then the
        // north leg around the bend. Strictly one wide the whole way.
        expect(coords).toEqual([
            '500,500', '600,500', '700,500', '800,500', '900,500', // east
            '900,400', '900,300', '900,200', '900,100'             // north
        ]);
    });

    test("reports a shortfall when the reachable area cannot seat everyone", async () => {
        const leader = {
            document: { x: 500, y: 500, width: 1, height: 1, delete: jest.fn() },
            center: { x: 550, y: 550 }
        };
        global.canvas.tokens.controlled = [leader];
        game.actors.filter.mockReturnValue([actor('a1'), actor('a2'), actor('a3')]);

        // A single-cell "closet": the leader cell is the only one in-region.
        global.canvas.regions.placeables = [{
            testPoint: (c) => Math.floor(c.x / 100) === 5 && Math.floor(c.y / 100) === 5
        }];

        eval(macroScript);
        const mockHtml = { find: jest.fn().mockReturnValue([{ checked: false }]) };
        await global.Dialog.mock.calls[0][0].buttons.find(b => b.action === "north").callback(null, null, { element: mockHtml });

        const created = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(created).toHaveLength(1); // only the leader cell could be filled
        expect(created[0].x).toBe(500); expect(created[0].y).toBe(500);
        expect(ui.notifications.warn).toHaveBeenCalledWith(
            expect.stringContaining('2 could not fit')
        );
    });
});

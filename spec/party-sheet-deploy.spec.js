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
    actors: []
};

global.ui = {
    notifications: {
        warn: jest.fn(),
        info: jest.fn()
    }
};

describe("Party Sheet Deploy Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.canvas.tokens.controlled = [];
        global.canvas.regions.placeables = [];
        global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(false);
        global.game.actors = [];
    });

    test("should warn if no token is selected", () => {
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith("Please select the Party Token first!");
    });

    test("should use leader footprint first", () => {
        global.canvas.tokens.controlled = [{
            document: { x: 500, y: 500, width: 2, height: 2, rotation: 90, delete: jest.fn() },
            center: { x: 600, y: 600 }
        }];
        
        global.game.actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];

        eval(macroScript);

        // 2x2 footprint: (0,0), (0,1), (1,0), (1,1)
        expect(canvas.scene.createEmbeddedDocuments).toHaveBeenCalledWith("Token", [
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 })
        ]);
    });

    test("should deploy in a 2-wide formation along the marching axis", () => {
        global.canvas.tokens.controlled = [{
            document: { x: 500, y: 500, width: 1, height: 1, rotation: 90, delete: jest.fn() }, // East (+X)
            center: { x: 550, y: 550 }
        }];
        
        // 4 actors: 1 in footprint, 3 expanding
        global.game.actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } },
            { id: 'a3', name: 'H3', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H3' }) } },
            { id: 'a4', name: 'H4', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H4' }) } }
        ];

        eval(macroScript);

        // Leader facing East: Primary=X, Secondary=Y. Lanes y=0, 1.
        // H1: Footprint (0,0) -> (500, 500)
        // H2: Neighbor (1,0) -> (600, 500) - in lane
        // H3: Neighbor (0,1) -> (500, 600) - in lane
        // H4: Neighbor of H2 or H3 -> (1,1) -> (600, 600) - in lane
        // Total: 2x2 block to the right of start
        
        const createdTokens = canvas.scene.createEmbeddedDocuments.mock.calls[0][1];
        expect(createdTokens).toHaveLength(4);
        expect(createdTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 600, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 }),
            expect.objectContaining({ x: 600, y: 600 })
        ]));
    });

    test("should fallback beyond walls and lanes if necessary", () => {
        global.canvas.tokens.controlled = [{
            document: { x: 500, y: 500, width: 1, height: 1, rotation: 90, delete: jest.fn() },
            center: { x: 550, y: 550 }
        }];

        // Mock walls everywhere
        global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(true);
        
        global.game.actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];

        eval(macroScript);

        // H1 in footprint, H2 in fallback
        // Neighbors of (0,0) with Side before Forward: (0,1), (0,-1), (1,0)
        expect(canvas.scene.createEmbeddedDocuments).toHaveBeenCalledWith("Token", [
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 }) // First fallback neighbor (Side)
        ]);
    });
});

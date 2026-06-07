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

    test("should warn if the party sheet is empty", () => {
        global.canvas.tokens.controlled = [{
            document: { x: 100, y: 100, width: 1, height: 1 },
            center: { x: 150, y: 150 }
        }];
        
        eval(macroScript);

        expect(ui.notifications.warn).toHaveBeenCalledWith("There are no characters currently in your OSE Party Sheet!");
    });

    test("should use leader footprint first", () => {
        global.canvas.tokens.controlled = [{
            document: { 
                x: 500, 
                y: 500,
                width: 2,
                height: 2,
                delete: jest.fn()
            },
            center: { x: 600, y: 600 }
        }];
        
        global.game.actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];

        eval(macroScript);

        // 2x2 footprint: (0,0), (0,1), (1,0), (1,1)
        // Spots at: (500,500), (500,600), (600,500), (600,600)
        expect(canvas.scene.createEmbeddedDocuments).toHaveBeenCalledWith("Token", [
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 500, y: 600 })
        ]);
    });

    test("should fallback beyond walls if no legal space left", () => {
        global.canvas.tokens.controlled = [{
            document: { 
                x: 500, 
                y: 500,
                width: 1,
                height: 1,
                delete: jest.fn()
            },
            center: { x: 550, y: 550 }
        }];

        // Mock walls everywhere around the start square (500,500)
        global.CONFIG.Canvas.polygonBackends.move.testCollision.mockReturnValue(true);
        
        global.game.actors = [
            { id: 'a1', name: 'H1', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H1' }) } },
            { id: 'a2', name: 'H2', type: 'character', flags: { ose: { party: true } }, prototypeToken: { toObject: () => ({ name: 'H2' }) } }
        ];

        eval(macroScript);

        // First actor takes footprint: (500,500)
        // Second actor must take a fallback spot (bfs ignores walls in phase 3)
        // neighbors of (0,0): (1,0), (0,1), (-1,0), (0,-1)
        expect(canvas.scene.createEmbeddedDocuments).toHaveBeenCalledWith("Token", [
            expect.objectContaining({ x: 500, y: 500 }),
            expect.objectContaining({ x: 600, y: 500 }) // First fallback neighbor found
        ]);
    });
});

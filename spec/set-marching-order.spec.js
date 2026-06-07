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

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});

describe("Set Marching Order Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should warn if no actors are in the party", () => {
        game.actors.filter.mockReturnValue([]);
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith("There are no characters currently in your OSE Party Sheet!");
    });

    test("should render dialog with sorted actors", () => {
        const actors = [
            { id: 'a2', name: 'Hero 2', flags: { ose: { marchingOrder: 2, party: true } } },
            { id: 'a1', name: 'Hero 1', flags: { ose: { marchingOrder: 1, party: true } } },
            { id: 'a3', name: 'Hero 3', flags: { ose: { party: true } } } // No order (999)
        ];
        game.actors.filter.mockReturnValue(actors);

        eval(macroScript);

        expect(Dialog).toHaveBeenCalled();
        const dialogContent = Dialog.mock.calls[0][0].content;
        
        // Verify order in HTML content (should be Hero 1, Hero 2, Hero 3)
        const h1Index = dialogContent.indexOf('Hero 1');
        const h2Index = dialogContent.indexOf('Hero 2');
        const h3Index = dialogContent.indexOf('Hero 3');
        
        expect(h1Index).toBeLessThan(h2Index);
        expect(h2Index).toBeLessThan(h3Index);
    });

    test("should save marching order on callback", async () => {
        const actors = [
            { id: 'a1', name: 'Hero 1', flags: { ose: { party: true } }, setFlag: jest.fn() }
        ];
        game.actors.filter.mockReturnValue(actors);
        game.actors.get.mockReturnValue(actors[0]);

        eval(macroScript);

        const callback = Dialog.mock.calls[0][0].buttons.save.callback;
        
        // Mock the HTML input finding
        const mockHtml = {
            find: jest.fn().mockReturnValue([
                { name: 'a1', value: '5' }
            ])
        };

        await callback(mockHtml);

        expect(actors[0].setFlag).toHaveBeenCalledWith("ose", "marchingOrder", 5);
        expect(ui.notifications.info).toHaveBeenCalledWith("Marching order saved.");
    });
});

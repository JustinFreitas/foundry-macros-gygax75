const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/console-log-item-weights.js'), 'utf8');

global.game = {
    items: {
        forEach: jest.fn()
    }
};

global.console = {
    log: jest.fn()
};

describe("Console Log Item Weights Macro", () => {

    beforeEach(() => {
        game.items.forEach.mockClear();
        console.log.mockClear();
    });

    test("should log the name and weight of each item", () => {
        const items = [
            { name: 'Item 1', system: { weight: 10 } },
            { name: 'Item 2', system: { weight: 20 } },
            { name: 'Item 3', system: {} },
        ];
        game.items.forEach.mockImplementation(callback => items.forEach(callback));

        eval(macroScript);

        expect(console.log).toHaveBeenCalledWith('Item: Item 1  Weight: 10');
        expect(console.log).toHaveBeenCalledWith('Item: Item 2  Weight: 20');
        expect(console.log).toHaveBeenCalledWith('Item: Item 3  Weight: 0');
    });
});

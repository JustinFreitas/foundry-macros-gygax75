const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/show-party-sheet.js'), 'utf8');

describe('ShowPartySheet', () => {
    let Hooks;

    beforeEach(() => {
        Hooks = {
            call: jest.fn()
        };
        global.Hooks = Hooks;
    });

    test('should call the OSE.Party.showSheet hook', () => {
        eval(macroScript);

        expect(Hooks.call).toHaveBeenCalledWith("OSE.Party.showSheet");
    });
});

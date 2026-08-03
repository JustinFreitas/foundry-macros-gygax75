const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/art-object-value.js'), 'utf8');

describe('ArtObjectValue Macro', () => {
    let mockRollTableMacro;

    beforeEach(() => {
        mockRollTableMacro = jest.fn();
        global.game = {
            ose: {
                rollTableMacro: mockRollTableMacro
            }
        };
    });

    test('should call game.ose.rollTableMacro with Art Object Value table UUID', () => {
        eval(macroScript);

        expect(mockRollTableMacro).toHaveBeenCalledWith("RollTable.artObjValTable01");
    });
});

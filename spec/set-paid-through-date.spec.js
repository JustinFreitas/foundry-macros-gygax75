global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/set-paid-through-date.js'), 'utf8');

class MockDialogV2 {
    static instances = [];
    static dateValue = '10/26/2025';

    constructor(data) {
        this.config = data;
        this.render = jest.fn();
        this.addEventListener = jest.fn();
        MockDialogV2.instances.push(this);
        const btn = data.buttons.find(b => b.action === 'ok');
        if (btn && btn.callback) {
            const value = MockDialogV2.dateValue;
            const html = {
                find: (selector) => {
                    if (selector === '#paid-through-date') {
                        return [{ value }];
                    }
                    return [];
                },
            };
            btn.callback(null, null, { element: html });
        }
    }
}

describe('set-paid-through-date', () => {
    let mockActor;

    beforeEach(() => {
        mockActor = {
            name: 'Test Actor',
            setFlag: jest.fn(),
            getFlag: jest.fn(),
        };

        global.canvas = {
            tokens: {
                controlled: [],
            },
        };

        global.ui = {
            notifications: {
                warn: jest.fn(),
                error: jest.fn(),
            },
        };

        MockDialogV2.instances = [];
        MockDialogV2.dateValue = '10/26/2025';
        global.Dialog = MockDialogV2;
        global.foundry = { applications: { api: { DialogV2: MockDialogV2 } } };

        global.ChatMessage = {
            create: jest.fn(),
        };
    });

    test('should warn if no tokens are selected', () => {
        canvas.tokens.controlled = [];
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith('No tokens selected.');
    });

    test('should display actor info in the dialog', () => {
        mockActor.getFlag.mockReturnValue('10/25/2025');
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);
        const dialogConfig = MockDialogV2.instances[0].config;
        expect(dialogConfig.content).toContain('Test Actor (10/25/2025)');
    });

    test('should display "Not Set" if date flag is not present', () => {
        mockActor.getFlag.mockReturnValue(undefined);
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);
        const dialogConfig = MockDialogV2.instances[0].config;
        expect(dialogConfig.content).toContain('Test Actor (Not Set)');
    });

    test('should set flag on selected actor', async () => {
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        await new Promise(process.nextTick); // Wait for async operations

        expect(mockActor.setFlag).toHaveBeenCalledWith('ose', 'paidThroughDate', '10/26/2025');
    });

    test('should create a chat message report', async () => {
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        await new Promise(process.nextTick); // Wait for async operations

        expect(ChatMessage.create).toHaveBeenCalledWith({
            content: `<h4>Paid Through Date Report</h4><p>Set 'paidThroughDate' for <strong>Test Actor</strong> to <strong>10/26/2025</strong>.</p>`,
        });
    });

    test('should show an error if date is not entered', () => {
        MockDialogV2.dateValue = '';
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        expect(ui.notifications.error).toHaveBeenCalledWith('Please enter a date.');
    });

    test('should show an error for an invalid date format', () => {
        MockDialogV2.dateValue = 'invalid date';
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        expect(ui.notifications.error).toHaveBeenCalledWith('Invalid date format. Please enter a date as MM/DD/YYYY.');
    });

    test('should interpret a 2-digit year as 20xx and normalize to MM/DD/YYYY', async () => {
        MockDialogV2.dateValue = '3/4/26';
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        await new Promise(process.nextTick);

        // Engine-independent: "3/4/26" must become 03/04/2026, never 1926.
        expect(mockActor.setFlag).toHaveBeenCalledWith('ose', 'paidThroughDate', '03/04/2026');
    });

    test('should reject an overflow date like 2/30/2025', () => {
        MockDialogV2.dateValue = '2/30/2025';
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        expect(ui.notifications.error).toHaveBeenCalledWith('Invalid date format. Please enter a date as MM/DD/YYYY.');
        expect(mockActor.setFlag).not.toHaveBeenCalled();
    });

    test('should pad single-digit month and day', async () => {
        MockDialogV2.dateValue = '1/5/2025';
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        await new Promise(process.nextTick);

        expect(mockActor.setFlag).toHaveBeenCalledWith('ose', 'paidThroughDate', '01/05/2025');
    });
});
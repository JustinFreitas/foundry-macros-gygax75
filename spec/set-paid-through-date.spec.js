const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/set-paid-through-date.js'), 'utf8');

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

        global.Dialog = jest.fn((data) => {
            // Immediately invoke the callback for testing purposes
            if (data.buttons.ok && data.buttons.ok.callback) {
                const html = {
                    find: (selector) => {
                        if (selector === '#paid-through-date') {
                            return [{ value: '10/26/2025' }];
                        }
                        return [];
                    },
                };
                data.buttons.ok.callback(html);
            }
            return {
                render: jest.fn(),
            };
        });

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
        const dialogConfig = global.Dialog.mock.calls[0][0];
        expect(dialogConfig.content).toContain('Test Actor (10/25/2025)');
    });

    test('should display "Not Set" if date flag is not present', () => {
        mockActor.getFlag.mockReturnValue(undefined);
        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);
        const dialogConfig = global.Dialog.mock.calls[0][0];
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
        global.Dialog = jest.fn((data) => {
            if (data.buttons.ok && data.buttons.ok.callback) {
                const html = {
                    find: () => [{ value: '' }],
                };
                data.buttons.ok.callback(html);
            }
            return {
                render: jest.fn(),
            };
        });

        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        expect(ui.notifications.error).toHaveBeenCalledWith('Please enter a date.');
    });

    test('should show an error for an invalid date format', () => {
        global.Dialog = jest.fn((data) => {
            if (data.buttons.ok && data.buttons.ok.callback) {
                const html = {
                    find: () => [{ value: 'invalid date' }],
                };
                data.buttons.ok.callback(html);
            }
            return {
                render: jest.fn(),
            };
        });

        canvas.tokens.controlled = [{ actor: mockActor }];
        eval(macroScript);

        expect(ui.notifications.error).toHaveBeenCalledWith('Invalid date format.');
    });
});
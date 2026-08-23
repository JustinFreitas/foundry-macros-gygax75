const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/claim-found-item.js'), 'utf8');

class MockDialogV2 {
    static instances = [];

    constructor(config) {
        this.config = config;
        this.data = config;
        this.element = document.createElement('div');
        this.element.innerHTML = typeof config.content === 'string' ? config.content : '';
        this.render = jest.fn();
        this.addEventListener = jest.fn();
        MockDialogV2.instances.push(this);
    }
}

describe("Claim Found Item Macro", () => {
    let mockActor;
    let mockItems;

    beforeEach(() => {
        MockDialogV2.instances = [];

        global.foundry = {
            applications: {
                api: {
                    DialogV2: MockDialogV2
                }
            }
        };
        global.Dialog = MockDialogV2;

        global.canvas = {
            tokens: {
                controlled: []
            }
        };

        global.game = {
            user: {
                character: null
            }
        };

        global.ui = {
            notifications: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        global.ChatMessage = {
            create: jest.fn().mockResolvedValue({})
        };

        mockItems = [
            {
                id: 'item1',
                name: 'Longsword +1 (Found)',
                img: 'icons/weapons/swords/sword-steel.webp',
                system: { quantity: { value: 1 } },
                update: jest.fn().mockResolvedValue({})
            },
            {
                id: 'item2',
                name: '100 GP (Found)',
                img: 'icons/commodities/currency/coins-gold.webp',
                system: { quantity: { value: 100 } },
                update: jest.fn().mockResolvedValue({})
            },
            {
                id: 'item3',
                name: 'Torch',
                img: 'icons/sundries/lights/torch-lit.webp',
                system: { quantity: { value: 5 } },
                update: jest.fn().mockResolvedValue({})
            }
        ];

        mockActor = {
            id: 'actor1',
            name: 'Krag Thorgrim',
            items: mockItems
        };
    });

    test("should notify and return if no tokens are selected and no user character exists", async () => {
        global.canvas.tokens.controlled = [];
        global.game.user.character = null;

        await eval(macroScript);

        expect(global.ui.notifications.info).toHaveBeenCalledWith("No character token selected.");
        expect(MockDialogV2.instances.length).toBe(0);
    });

    test("should fall back to game.user.character if no tokens are controlled", async () => {
        global.canvas.tokens.controlled = [];
        global.game.user.character = mockActor;

        await eval(macroScript);

        expect(MockDialogV2.instances.length).toBe(1);
        expect(MockDialogV2.instances[0].render).toHaveBeenCalledWith(true);
    });

    test("should notify and return if the actor has no (Found) items", async () => {
        const actorNoFound = {
            id: 'actor2',
            name: 'Lyra Moonshadow',
            items: [
                { id: 'i1', name: 'Dagger', update: jest.fn() },
                { id: 'i2', name: 'Rope (50ft)', update: jest.fn() }
            ]
        };
        global.canvas.tokens.controlled = [{ actor: actorNoFound }];

        await eval(macroScript);

        expect(global.ui.notifications.info).toHaveBeenCalledWith("Lyra Moonshadow has no (Found) items to claim.");
        expect(MockDialogV2.instances.length).toBe(0);
    });

    test("should render DialogV2 with correct classes, position, and items list", async () => {
        global.canvas.tokens.controlled = [{ actor: mockActor }];

        await eval(macroScript);

        expect(MockDialogV2.instances.length).toBe(1);
        const dialog = MockDialogV2.instances[0];

        // Check DialogV2 options
        expect(dialog.config.classes).toEqual(["ose", "dialog"]);
        expect(dialog.config.position).toEqual({ width: 450, height: "auto" });
        expect(dialog.config.window.title).toContain("Krag Thorgrim");
        expect(dialog.render).toHaveBeenCalledWith(true);
        expect(dialog.addEventListener).toBeDefined();

        // Check HTML content contains items
        const html = dialog.element;
        const checkboxes = html.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(2); // Only item1 and item2 have (Found)
        expect(checkboxes[0].value).toBe("item1");
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].value).toBe("item2");
        expect(checkboxes[1].checked).toBe(true);

        expect(html.innerHTML).toContain("Longsword +1");
        expect(html.innerHTML).toContain("100 GP");
        expect(html.innerHTML).toContain("(Qty: 100)");
        expect(html.innerHTML).not.toContain("Torch");
    });

    test("should update item names and create ChatMessage on submit for checked items", async () => {
        global.canvas.tokens.controlled = [{ actor: mockActor }];

        await eval(macroScript);

        const dialog = MockDialogV2.instances[0];
        const claimButton = dialog.config.buttons.find(b => b.action === "claim");
        expect(claimButton).toBeDefined();
        expect(claimButton.label).toBe("Claim as Personal Gear");

        // Submit with all items checked
        await claimButton.callback(null, claimButton, dialog);

        expect(mockItems[0].update).toHaveBeenCalledWith({ name: "Longsword +1" });
        expect(mockItems[1].update).toHaveBeenCalledWith({ name: "100 GP" });
        expect(mockItems[2].update).not.toHaveBeenCalled();

        expect(global.ChatMessage.create).toHaveBeenCalledWith({
            content: "<h3>Item Claimed</h3><p><b>Krag Thorgrim</b> has claimed <b>Longsword +1, 100 GP</b> as personal equipment.</p>"
        });
    });

    test("should only update checked items when some are unchecked", async () => {
        global.canvas.tokens.controlled = [{ actor: mockActor }];

        await eval(macroScript);

        const dialog = MockDialogV2.instances[0];
        const html = dialog.element;

        // Uncheck the second item (100 GP)
        const secondCheckbox = html.querySelector('#claim-item-item2');
        secondCheckbox.checked = false;

        const claimButton = dialog.config.buttons.find(b => b.action === "claim");
        await claimButton.callback(null, claimButton, dialog);

        expect(mockItems[0].update).toHaveBeenCalledWith({ name: "Longsword +1" });
        expect(mockItems[1].update).not.toHaveBeenCalled();

        expect(global.ChatMessage.create).toHaveBeenCalledWith({
            content: "<h3>Item Claimed</h3><p><b>Krag Thorgrim</b> has claimed <b>Longsword +1</b> as personal equipment.</p>"
        });
    });

    test("should notify and not update items or create chat message if no items are checked on submit", async () => {
        global.canvas.tokens.controlled = [{ actor: mockActor }];

        await eval(macroScript);

        const dialog = MockDialogV2.instances[0];
        const html = dialog.element;

        // Uncheck all checkboxes
        const checkboxes = html.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = false; });

        const claimButton = dialog.config.buttons.find(b => b.action === "claim");
        await claimButton.callback(null, claimButton, dialog);

        expect(global.ui.notifications.info).toHaveBeenCalledWith("No items selected to claim.");
        expect(mockItems[0].update).not.toHaveBeenCalled();
        expect(mockItems[1].update).not.toHaveBeenCalled();
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    test("should support cancellation without making changes", async () => {
        global.canvas.tokens.controlled = [{ actor: mockActor }];

        await eval(macroScript);

        const dialog = MockDialogV2.instances[0];
        const cancelButton = dialog.config.buttons.find(b => b.action === "cancel");
        expect(cancelButton).toBeDefined();
        expect(cancelButton.label).toBe("Cancel");

        if (cancelButton.callback) {
            await cancelButton.callback(null, cancelButton, dialog);
        }

        expect(mockItems[0].update).not.toHaveBeenCalled();
        expect(mockItems[1].update).not.toHaveBeenCalled();
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });
});

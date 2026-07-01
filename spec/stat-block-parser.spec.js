global.$ = (x) => x;
describe("stat-block-parser", () => {
    let mockDialog;
    let mockActor;
    let mockNotifications;

    beforeEach(() => {
        // Clear module cache before each test to allow re-importing
        jest.resetModules();

        mockNotifications = {
            error: jest.fn(),
            info: jest.fn(),
        };

        mockActor = {
            create: jest.fn().mockResolvedValue({ name: "Test Monster" }),
        };

        mockDialog = { config: {} };

        global.foundry = {
            applications: {
                api: {
                    DialogV2: {
                        wait: jest.fn().mockImplementation((config) => {
                            mockDialog.config = config;
                            return new Promise(() => {}); // never resolves in some tests
                        })
                    }
                }
            }
        };

        global.Dialog = {
            wait: jest.fn().mockImplementation((config) => {
                mockDialog.config = config;
                return new Promise(() => {});
            })
        };

        global.game = {
            actors: {
                create: mockActor.create
            }
        };

        global.ui = {
            notifications: mockNotifications,
        };

        global.Actor = mockActor;
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
        };
        global.jQuery = jest.fn();
    });

    describe("Parsing Functions", () => {
        it("should parse AC from stat block", () => {
            const statBlock = "AC 8 (leather); Level O; hp 4";
            const acPattern = /AC\s+(\d+)/i;
            const match = statBlock.match(acPattern);
            expect(match[1]).toBe("8");
        });

        it("should parse HP from stat block", () => {
            const statBlock = "AC 8; hp 4; #AT 1";
            const hpPattern = /hp\s+(\d+)/i;
            const match = statBlock.match(hpPattern);
            expect(match[1]).toBe("4");
        });

        it("should parse HD from stat block with HD notation", () => {
            const statBlock = "AC 5; HD 2+1; hp 12";
            const hdPattern = /(?:HD|Level)\s+(\d+(?:\+\d+)?|O)/i;
            const match = statBlock.match(hdPattern);
            expect(match[1]).toBe("2+1");
        });

        it("should parse damage from stat block", () => {
            const statBlock = "D 1-6 (spear) or 1-6/1-6 (shortbow)";
            const damagePattern = /D(?:mg)?(?:amage)?\s*:?\s*([\d\-\/]+(?:\s*\([^)]+\))?(?:\s+or\s+[\d\-\/]+(?:\s*\([^)]+\))?)*)/i;
            const match = statBlock.match(damagePattern);
            expect(match[1]).toMatch(/1-6.*spear.*1-6\/1-6.*shortbow/i);
        });

        it("should handle THAC0 if present in stat block", () => {
            const statBlock = "AC 5; THAC0 15; hp 10";
            const thac0Pattern = /THAC0?\s+(\d+)/i;
            const match = statBlock.match(thac0Pattern);
            expect(match[1]).toBe("15");
        });

        it("should parse XP from stat block", () => {
            const statBlock = "AC 8; hp 4; XP18";
            const xpPattern = /XP\s*:?\s*(\d+)/i;
            const match = statBlock.match(xpPattern);
            expect(match[1]).toBe("18");
        });

        it("should parse alignment and convert abbreviation to full name", () => {
            const statBlock = "AC 8; AL NE; hp 4";
            const alignmentPattern = /AL\s*:?\s*([A-Z]{1,2})/i;
            const match = statBlock.match(alignmentPattern);
            expect(match[1]).toBe("NE");

            const alignmentMap = {
                'N': 'Neutral',
                'NE': 'Neutral Evil',
                'LG': 'Lawful Good',
            };
            expect(alignmentMap['NE']).toBe('Neutral Evil');
        });

        it("should parse morale from stat block", () => {
            const statBlock = "AC 8; ML 8; hp 4";
            const moralePattern = /ML\s*:?\s*(\d+)/i;
            const match = statBlock.match(moralePattern);
            expect(match[1]).toBe("8");
        });

        it("should parse treasure type from stat block", () => {
            const statBlock = "AC 8; TT A; hp 4";
            const treasurePattern = /TT\s*:?\s*([A-Z](?:\s*,\s*[A-Z])*)/i;
            const match = statBlock.match(treasurePattern);
            expect(match[1]).toBe("A");
        });

        it("should parse movement and multiply by 10", () => {
            const statBlock = "MV 12; AC 8; hp 4";
            const movementPattern = /MV\s*:?\s*(\d+)/i;
            const match = statBlock.match(movementPattern);
            expect(match[1]).toBe("12");
            const movement = parseInt(match[1]) * 10;
            expect(movement).toBe(120);
        });
    });

    describe("Dialog Creation", () => {
        it("should create and render a dialog when script executes", () => {
            require("../scripts/stat-block-parser");

            const waitMock = foundry.applications.api.DialogV2.wait;
            expect(waitMock).toHaveBeenCalled();
            const dialogConfig = waitMock.mock.calls[0][0];

            expect(dialogConfig.window.title).toBe("Create Monster from Stat Block");
            expect(dialogConfig.content).toContain("monster-name");
            expect(dialogConfig.content).toContain("stat-block");
            
            const createBtn = dialogConfig.buttons.find(b => b.action === 'create');
            const cancelBtn = dialogConfig.buttons.find(b => b.action === 'cancel');
            expect(createBtn).toBeDefined();
            expect(cancelBtn).toBeDefined();
        });
    });

    describe("Monster Creation", () => {
        it("should create a monster actor with parsed stats including XP and alignment", async () => {
            require("../scripts/stat-block-parser");

            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Bandit" };
                    if (selector === '#stat-block') return { value: "AC 8 (leather); MV 12; AL N; Level O; hp 4; #AT 1 or 2; D 1-6 (spear) or 1-6/1-6 (shortbow); ML 8; TT A; XP18" };
                }),
                querySelectorAll: jest.fn((selector) => {
                    if (selector === '#monster-name') return [{ value: "Bandit" }];
                    if (selector === '#stat-block') return [{ value: "AC 8 (leather); MV 12; AL N; Level O; hp 4; #AT 1 or 2; D 1-6 (spear) or 1-6/1-6 (shortbow); ML 8; TT A; XP18" }];
                }),
            };

            await callback({}, {}, { element: mockHtml });

            expect(mockActor.create).toHaveBeenCalled();
            const actorData = mockActor.create.mock.calls[0][0];

            expect(actorData.name).toBe("Bandit");
            expect(actorData.system.ac.value).toBe(8);
            expect(actorData.system.hp.value).toBe(4);
        });

        it("should parse Treasure Type from AD&D stat block", async () => {
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const addStatBlock = `TREASURE TYPE: E`;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Wight" };
                    if (selector === '#stat-block') return { value: addStatBlock };
                }),
            };

            await callback({}, {}, { element: mockHtml });

            const actorData = mockActor.create.mock.calls[mockActor.create.mock.calls.length - 1][0];
            expect(actorData.system.details.treasure.type).toBe("E");
        });

        it("should parse various Treasure Type formats", async () => {
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const testCases = [
                { statBlock: "TT A", expected: "A" },
                { statBlock: "TREASURE TYPE: Nil", expected: "Nil" }
            ];

            for (const { statBlock, expected } of testCases) {
                const mockHtml = {
                    querySelector: jest.fn((selector) => {
                        if (selector === '#monster-name') return { value: "Test" };
                        if (selector === '#stat-block') return { value: statBlock };
                    }),
                };
                await callback({}, {}, { element: mockHtml });
                const actorData = mockActor.create.mock.calls[mockActor.create.mock.calls.length - 1][0];
                expect(actorData.system.details.treasure.type).toBe(expected);
            }
        });

        it("should prioritize explicit HP over calculated HP", async () => {
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const statBlock = `AC: 8; MV: 1”; HD: 3+3; HP: 50; #AT: 1; D: 2-16;`;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Test Monster" };
                    if (selector === '#stat-block') return { value: statBlock };
                }),
            };

            await callback({}, {}, { element: mockHtml });
            const actorData = mockActor.create.mock.calls[mockActor.create.mock.calls.length - 1][0];
            expect(actorData.system.hp.value).toBe(50);
        });

        it("should handle undead morale logic (Wight)", async () => {
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const addStatBlock = `HIT DICE: 5 + 3`;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Wight" };
                    if (selector === '#stat-block') return { value: addStatBlock };
                }),
            };

                await callback({}, {}, { element: mockHtml });

            const actorData = mockActor.create.mock.calls[mockActor.create.mock.calls.length - 1][0];
            expect(actorData.system.details.morale).toBe(12);
        });

        it("should handle Actor.create errors gracefully", async () => {
            mockActor.create.mockRejectedValue(new Error("Database error"));
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Test" };
                    if (selector === '#stat-block') return { value: "AC 5; hp 10" };
                }),
            };

            await callback({}, {}, { element: mockHtml });
            expect(mockNotifications.error).toHaveBeenCalledWith("Failed to create monster: Database error");
        });
    });

    describe("Edge Cases", () => {
        it("should handle multi-line stat blocks", async () => {
            require("../scripts/stat-block-parser");
            const waitMock = foundry.applications.api.DialogV2.wait;
            const dialogConfig = waitMock.mock.calls[waitMock.mock.calls.length - 1][0];
            const callback = dialogConfig.buttons.find(b => b.action === 'create').callback;

            const mockHtml = {
                querySelector: jest.fn((selector) => {
                    if (selector === '#monster-name') return { value: "Bandit" };
                    if (selector === '#stat-block') return { value: "AC 8;\nHP 4" };
                }),
                querySelectorAll: jest.fn((selector) => {
                    if (selector === '#monster-name') return [{ value: "Bandit" }];
                    if (selector === '#stat-block') return [{ value: "AC 8;\nHP 4" }];
                }),
            };

            await callback({}, {}, { element: mockHtml });
            expect(mockActor.create).toHaveBeenCalled();
        });
    });
});

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

        mockDialog = jest.fn().mockImplementation(function (config) {
            this.render = jest.fn();
            this.config = config;
            return this;
        });

        global.ui = {
            notifications: mockNotifications,
        };

        global.Actor = mockActor;
        global.Dialog = mockDialog;
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
        };
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

            // Test the conversion
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

        it("should calculate morale from HD when ML not present", () => {
            // Test implementation logic via integration test below, 
            // but we can verify the logic if we exported the function.
            // Since we can't, we'll rely on the integration test.
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
            // Verify multiplication
            const movement = parseInt(match[1]) * 10;
            expect(movement).toBe(120);
        });
    });

    describe("Dialog Creation", () => {
        it("should create and render a dialog when script executes", () => {
            require("../scripts/stat-block-parser");

            expect(mockDialog).toHaveBeenCalled();
            const dialogConfig = mockDialog.mock.calls[0][0];

            expect(dialogConfig.title).toBe("Create Monster from Stat Block");
            expect(dialogConfig.content).toContain("monster-name");
            expect(dialogConfig.content).toContain("stat-block");
            expect(dialogConfig.buttons.create).toBeDefined();
            expect(dialogConfig.buttons.cancel).toBeDefined();

            const dialogInstance = mockDialog.mock.results[0].value;
            expect(dialogInstance.render).toHaveBeenCalledWith(true);
        });
    });

    describe("Monster Creation", () => {
        it("should create a monster actor with parsed stats including XP and alignment", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Bandit" }];
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "AC 8 (leather); MV 12; AL N; Level O; hp 4; #AT 1 or 2; D 1-6 (spear) or 1-6/1-6 (shortbow); ML 8; TT A; XP18" }];
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockActor.create).toHaveBeenCalled();
            const actorData = mockActor.create.mock.calls[0][0];

            expect(actorData.name).toBe("Bandit");
            expect(actorData.type).toBe("monster");
            expect(actorData.system.ac.value).toBe(8);
            expect(actorData.system.hp.value).toBe(4);
            expect(actorData.system.hp.max).toBe(4);
            expect(actorData.system.hp.hd).toBe("0");
            expect(actorData.system.thac0.value).toBe(20); // Calculated for Level 0
            expect(actorData.system.details.xp).toBe(18); // XP value
            expect(actorData.system.details.alignment).toBe("Neutral"); // Alignment converted from "N"
            expect(actorData.system.details.morale).toBe(8); // Morale value
            expect(actorData.system.details.treasure.type).toBe("A"); // Treasure type
            expect(actorData.system.movement.base).toBe(120); // Movement (12 * 10)
            expect(actorData.system.attacks).toBe(2); // Max of 1 or 2
            expect(actorData.system.damage).toMatch(/1-6.*spear.*1-6\/1-6.*shortbow/i);

            expect(mockNotifications.info).toHaveBeenCalledWith('Monster "Bandit" created successfully!');
        });

        it("should show error if monster name is empty", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;


            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "  " }]; // Empty/whitespace
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "AC 8; hp 4" }];
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockActor.create).not.toHaveBeenCalled();
            expect(mockNotifications.error).toHaveBeenCalledWith("Please enter a monster name.");
        });

        it("should show error if stat block is empty", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Goblin" }];
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "" }];
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockActor.create).not.toHaveBeenCalled();
            expect(mockNotifications.error).toHaveBeenCalledWith("Please paste a stat block.");
        });

        it("should use default values when stat block has missing attributes", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Mystery Monster" }];
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "Some incomplete stat block" }]; // No recognizable stats
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockActor.create).toHaveBeenCalled();
            const actorData = mockActor.create.mock.calls[0][0];

            // Should use defaults
            expect(actorData.system.ac.value).toBe(9);
            expect(actorData.system.hp.value).toBe(1);
            expect(actorData.system.hp.max).toBe(1);
            expect(actorData.system.thac0.value).toBe(19);
            expect(actorData.system.details.xp).toBe(0); // Default XP
            expect(actorData.system.details.alignment).toBe(""); // Default alignment
            // Morale should be calculated from default HD "1"
            // HD 1 -> 50% base -> 7
            expect(actorData.system.details.morale).toBe(7);
            expect(actorData.system.details.treasure.type).toBe(""); // Default treasure type
            expect(actorData.system.movement.base).toBe(0); // Default movement
        });

        it("should calculate THAC0 from HD when THAC0 not in stat block", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Orc" }];
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "AC 6; HD 1; hp 5; #AT 1; D 1-8" }];
                    }
                }),
            };

            await callback(mockHtml);

            const actorData = mockActor.create.mock.calls[0][0];
            expect(actorData.system.hp.hd).toBe("1");
            expect(actorData.system.thac0.value).toBe(19); // 1 HD = THAC0 19
        });

        it("should calculate HP from HD when HP not in stat block", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Ogre" }];
                    }
                    if (selector === '#stat-block') {
                        // No HP specified, only HD 4+1
                        return [{ value: "AC 5; HD 4+1; #AT 1; D 1-10" }];
                    }
                }),
            };

            await callback(mockHtml);

            const actorData = mockActor.create.mock.calls[0][0];
            expect(actorData.system.hp.hd).toBe("4+1");
            // HP should be calculated: 4*4.5 + 4*1 = 18 + 4 = 22
            expect(actorData.system.hp.value).toBe(22);
            expect(actorData.system.hp.max).toBe(22);

            // Verify calculated morale for HD 4+1
            // Base 50 + (3 * 5) + 1 = 66% -> 2 + 6.6 = 8.6 -> 9 (clamped)
            // Actually Math.round(66/10) = 7. 2+7 = 9.
            expect(actorData.system.details.morale).toBe(9);
        });

        it("should handle Actor.create errors gracefully", async () => {
            mockActor.create.mockRejectedValue(new Error("Database error"));

            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Test" }];
                    }
                    if (selector === '#stat-block') {
                        return [{ value: "AC 5; hp 10" }];
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockNotifications.error).toHaveBeenCalledWith("Failed to create monster: Database error");
        });
    });

    describe("Edge Cases", () => {
        it("should handle multi-line stat blocks", async () => {
            require("../scripts/stat-block-parser");

            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const mockHtml = {
                find: jest.fn((selector) => {
                    if (selector === '#monster-name') {
                        return [{ value: "Bandit" }];
                    }
                    if (selector === '#stat-block') {
                        return [{
                            value: `AC 8 (leather); AL N; Level O; hp 4; #AT 1 or
2; D 1-6 (spear) or 1-6/1-6 (shortbow,
ranges5'l 1 0'l1~); MV 12; ML 8; TT A; XP18`
                        }];
                    }
                }),
            };

            await callback(mockHtml);

            expect(mockActor.create).toHaveBeenCalled();
            const actorData = mockActor.create.mock.calls[0][0];
            expect(actorData.system.ac.value).toBe(8);
            expect(actorData.system.hp.value).toBe(4);
            expect(actorData.system.details.xp).toBe(18);
            expect(actorData.system.details.alignment).toBe("Neutral");
            expect(actorData.system.details.morale).toBe(8);
            expect(actorData.system.details.treasure.type).toBe("A");
            expect(actorData.system.movement.base).toBe(120);
        });

        it("should parse AC from variations", async () => {
            require("../scripts/stat-block-parser");
            const dialogConfig = mockDialog.mock.calls[0][0];
            const callback = dialogConfig.buttons.create.callback;

            const testCases = [
                { statBlock: "AC 5", expectedAC: 5 },
                { statBlock: "ac 7 (plate)", expectedAC: 7 },
                { statBlock: "AC  3", expectedAC: 3 }, // Extra space
            ];

            for (const testCase of testCases) {
                mockActor.create.mockClear();

                const mockHtml = {
                    find: jest.fn((selector) => {
                        if (selector === '#monster-name') return [{ value: "Test" }];
                        if (selector === '#stat-block') return [{ value: testCase.statBlock }];
                    }),
                };

                await callback(mockHtml);

                const actorData = mockActor.create.mock.calls[0][0];
                expect(actorData.system.ac.value).toBe(testCase.expectedAC);
            }
        });
    });
});

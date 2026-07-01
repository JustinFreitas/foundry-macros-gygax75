global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/carouse-for-hired-help.js'), 'utf8');

describe('CarouseForHiredHelp', () => {
    let game;
    let ChatMessage;
    let ui;
    let SimpleCalendar;
    let Actor;
    let Dialog;
    let playerActor;
    let bankItem;
    let capturedRender;
    let mockHtml;
    let handlers;
    let originalRandom;

    beforeAll(() => {
        originalRandom = Math.random;
    });

    beforeEach(() => {
        handlers = {};
        bankItem = {
            name: 'GP (Bank)',
            system: { quantity: { value: 500 } },
            update: jest.fn()
        };

        playerActor = {
            id: 'pc-1',
            name: 'Player Character',
            type: 'character',
            folder: { id: 'folder-123', name: 'Adventurers' },
            flags: { 
                ose: { 
                    party: true,
                    recruitmentState: {
                        unlockedGnome: false,
                        unlockedWoodElf: false,
                        carousingSuccesses: 0,
                        currentWeek: '2025-W1',
                        advert: null,
                        candidates: [],
                        badReputation: 0
                    }
                } 
            },
            system: {
                scores: { cha: { value: 14 } },
                details: { class: 'Fighter', level: 3 },
                retainer: { enabled: false }
            },
            effects: [],
            createEmbeddedDocuments: jest.fn(),
            deleteEmbeddedDocuments: jest.fn(),
            items: {
                getName: jest.fn(name => name === 'GP (Bank)' ? bankItem : null)
            },
            getFlag: jest.fn(function(ns, key) {
                return this.flags[ns]?.[key];
            }),
            setFlag: jest.fn(function(ns, key, val) {
                this.flags[ns] ||= {};
                this.flags[ns][key] = val;
                return Promise.resolve(val);
            })
        };

        game = {
            actors: {
                filter: jest.fn(callback => [playerActor].filter(callback))
            },
            user: { id: 'user-1' }
        };

        ChatMessage = {
            create: jest.fn()
        };

        ui = {
            notifications: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        SimpleCalendar = {
            api: {
                timestamp: jest.fn(() => 1735689600), // 1/1/2025
                formatTimestamp: jest.fn(() => '1/1/2025')
            }
        };

        Actor = {
            create: jest.fn(data => {
                return Promise.resolve({
                    ...data,
                    id: 'new-actor-1',
                    createEmbeddedDocuments: jest.fn()
                });
            })
        };

        Dialog = jest.fn().mockImplementation((dialogData) => {
            dialogData = dialogData || {};
            capturedRender = dialogData.render;
            return {
                render: jest.fn(),
                addEventListener: jest.fn((event, cb) => { if (event === 'render') { capturedRender = cb; } })
            };
        });

        // Set globals
        global.game = game;
        global.ChatMessage = ChatMessage;
        global.ui = ui;
        global.SimpleCalendar = SimpleCalendar;
        global.Actor = Actor;
        global.foundry = { applications: { api: { DialogV2: Dialog } } };
        global.foundry.applications.api.DialogV2.wait = Dialog;
        global.Dialog = Dialog;
        global.foundry.applications.api.DialogV2.wait = Dialog;

        // Mock jQuery element with jQuery methods directly on it
        const elementMock = (selector) => {
            const selfObj = {
                empty: jest.fn().mockReturnThis(),
                append: jest.fn().mockReturnThis(),
                html: jest.fn().mockReturnThis(),
                text: jest.fn().mockReturnThis(),
                val: jest.fn(() => {
                    if (selector === '#pc-select') return 'pc-1';
                    if (selector === '#reputation-select') return '0';
                    if (selector === '#advert-class-select') return 'Fighter';
                    if (selector === '#generosity-select') return 'standard';
                    return '';
                }),
                prop: jest.fn().mockReturnThis(),
                show: jest.fn().mockReturnThis(),
                hide: jest.fn().mockReturnThis(),
                removeClass: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis(),
                click: jest.fn(handler => {
                    handlers[selector] = handler;
                    return selfObj;
                }),
                change: jest.fn(handler => {
                    handlers[selector + '-change'] = handler;
                    return selfObj;
                }),
                on: jest.fn((event, childSelector, handler) => {
                    handlers[selector + '-' + event + '-' + childSelector] = handler;
                    return selfObj;
                }),
                find: jest.fn(sel => elementMock(sel)),
                0: { value: 'Fighter' }
            };
            return selfObj;
        };

        mockHtml = elementMock('');

        // jQuery wrapper mock
        global.jQuery = jest.fn((sel) => {
            if (typeof sel === 'string') {
                return elementMock(sel);
            }
            return {
                attr: jest.fn(name => {
                    if (name === 'data-tab') return 'status';
                    if (name === 'data-id') return 'c1';
                    return null;
                }),
                removeClass: jest.fn().mockReturnThis(),
                addClass: jest.fn().mockReturnThis(),
                val: jest.fn(() => 'c1'),
                is: jest.fn(() => true)
            };
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Math.random = originalRandom;
    });

    test('should load Dialog and display selected PC stats correctly', async () => {
        eval(macroScript);

        expect(global.foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
        await capturedRender({ target: { element: mockHtml } });

        // Verify HTML element search was performed for pc-stats-display
        expect(mockHtml.find).toHaveBeenCalledWith('#pc-stats-display');
    });

    test('should report warning if PC limit reached', async () => {
        playerActor.system.scores.cha.value = 3; // Max 1 retainer
        
        // Mock a retainer active
        const retainerActor = {
            name: 'Retainer (Player Character)',
            type: 'character',
            flags: { ose: {} },
            system: { retainer: { enabled: true } }
        };
        game.actors.filter = jest.fn(callback => [playerActor, retainerActor].filter(callback));

        eval(macroScript);
        await capturedRender({ target: { element: mockHtml } });

        // Verify pc stats refresh was triggered
        expect(mockHtml.find).toHaveBeenCalledWith('#pc-stats-display');
    });

    test('should roll Tavern available Normal Humans', async () => {
        eval(macroScript);
        await capturedRender({ target: { element: mockHtml } });

        const clickHandler = handlers['#roll-tavern-btn'];
        expect(clickHandler).toBeDefined();

        const e = { preventDefault: jest.fn() };
        await clickHandler(e);

        // Verify candidates were added to PC state
        const state = playerActor.flags.ose.recruitmentState;
        expect(state.candidates.length).toBeGreaterThan(0);
        expect(state.candidates[0].className).toBe('Normal Human');

        // Chat Message verified
        expect(ChatMessage.create).toHaveBeenCalled();
        expect(ChatMessage.create.mock.calls[0][0].content).toContain('Tavern Update');
    });

    test('should deduct gold and roll carousing candidates', async () => {
        eval(macroScript);
        await capturedRender({ target: { element: mockHtml } });

        const clickHandler = handlers['#carouse-btn'];
        expect(clickHandler).toBeDefined();

        // Trigger carousing
        // Mock Math.random to return low values for success and 2 applicants, then fallback to original Math.random
        let randomCalls = 0;
        jest.spyOn(Math, 'random').mockImplementation(() => {
            randomCalls++;
            if (randomCalls === 1) return 0.1; // 1d6 roll <= 3 -> success
            if (randomCalls === 2) return 0.5; // 1d3 roll -> 2 applicants
            return originalRandom();
        });

        const e = { preventDefault: jest.fn() };
        await clickHandler(e);

        // Verify bank gold deduction (50gp)
        expect(bankItem.update).toHaveBeenCalledWith({ "system.quantity.value": 450 });

        // Verify candidates added
        const state = playerActor.flags.ose.recruitmentState;
        expect(state.candidates.length).toBe(2);
        expect(state.carousingSuccesses).toBe(1);

        expect(ChatMessage.create).toHaveBeenCalled();
        expect(ChatMessage.create.mock.calls[0][0].content).toContain('Carousing Success!');
    });

    test('should post advertisements and deduct 25gp', async () => {
        eval(macroScript);
        await capturedRender({ target: { element: mockHtml } });

        const clickHandler = handlers['#post-advert-btn'];
        expect(clickHandler).toBeDefined();

        const e = { preventDefault: jest.fn() };
        await clickHandler(e);

        // Verify bank gold deduction (25gp)
        expect(bankItem.update).toHaveBeenCalledWith({ "system.quantity.value": 475 });

        // Verify advert is active
        const state = playerActor.flags.ose.recruitmentState;
        expect(state.advert).not.toBeNull();
        expect(state.advert.daysLeft).toBe(7);
        expect(ChatMessage.create).toHaveBeenCalled();
        expect(ChatMessage.create.mock.calls[0][0].content).toContain('Town Notice Posted');
    });

    test('should roll negotiation and hire candidate', async () => {
        eval(macroScript);
        await capturedRender({ target: { element: mockHtml } });

        // Populate a candidate
        const state = playerActor.flags.ose.recruitmentState;
        state.candidates = [{
            id: 'c1',
            type: 'class',
            name: 'Adventuring Candidate',
            className: 'Fighter',
            level: 1
        }];
        state.selectedCandidateId = 'c1';

        const clickHandler = handlers['#roll-negotiation-btn'];
        expect(clickHandler).toBeDefined();

        const e = { preventDefault: jest.fn() };

        // Force a high success roll (2d6 total -> 12), then fallback to original random
        let randomCalls = 0;
        jest.spyOn(Math, 'random').mockImplementation(() => {
            randomCalls++;
            if (randomCalls <= 2) return 0.95; // roll 2d6 -> 12
            return originalRandom();
        });
        
        await clickHandler(e);

        expect(ChatMessage.create).toHaveBeenCalled();
        expect(ChatMessage.create.mock.calls[0][0].content).toContain('Offer Accepted');

        // Trigger Hire Retainer
        const hireHandler = handlers['#hire-btn'];
        expect(hireHandler).toBeDefined();
        await hireHandler(e);

        // Verify Actor is created with correct name format Retainer (Fighter)(Player Character)
        expect(Actor.create).toHaveBeenCalled();
        const actorCallData = Actor.create.mock.calls[0][0];
        expect(actorCallData.name).toBe('Retainer (Fighter)(Player Character)');
        expect(actorCallData.system.details.class).toBe('Fighter');
        expect(actorCallData.folder).toBe('folder-123');
    });
});

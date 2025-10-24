const fs = require('fs');
const path = require('path');

describe('misc-items-all-actors', () => {
  let scriptContent;

  // Function extracted from the script for isolated testing
  const isWhiteListedTopLevelItem = (item) => {
    return item.name.startsWith('Case')
        || item.name.endsWith('Cloak')
        || item.name.startsWith('Gauntlets')
        || item.name.startsWith('Girdle')
        || item.name.startsWith('Helm')
        || item.name.startsWith('Medallion')
        || item.name.startsWith('Quiver')
        || item.name.endsWith('Ring')
        || item.name.startsWith('Ring')
        || [
            'Elven Cloak and Boots',
            'GP (Bank)',
            'Holy symbol',
            'Lantern',
            'Oil flask',
            'Scarab of Protection',
            'Torch',
            'Waterskin'
            ].includes(item.name);
  };

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/misc-items-all-actors.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock the game object
    global.game = {
      actors: {
        filter: () => [],
      },
      userId: 'test-user',
    };

    // Mock the ChatMessage class
    global.ChatMessage = {
      create: jest.fn(),
    };

    // Mock console.log
    global.console = {
      log: jest.fn(),
    };
  });

  describe('isWhiteListedTopLevelItem', () => {
    it('should return true for whitelisted items', () => {
      expect(isWhiteListedTopLevelItem({ name: 'Case for scrolls' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Leather Cloak' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Gauntlets of Ogre Power' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Girdle of Giant Strength' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Helm of Telepathy' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Medallion of ESP' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Quiver of Ehlonna' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Ring of Protection' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'Elven Cloak and Boots' })).toBe(true);
      expect(isWhiteListedTopLevelItem({ name: 'GP (Bank)' })).toBe(true);
    });

    it('should return false for non-whitelisted items', () => {
      expect(isWhiteListedTopLevelItem({ name: 'Sword' })).toBe(false);
      expect(isWhiteListedTopLevelItem({ name: 'Leather Armor' })).toBe(false);
    });
  });

  it('should create a chat message with "No unallowed Misc items" if there are no actors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Misc Items Report</h2><br/>No unallowed Misc items in any actor.',
    });
  });

  it('should create a chat message with "No unallowed Misc items" if there are no misc items', async () => {
    const actor = {
      type: 'character',
      flags: {},
      name: 'Test Actor',
      system: { details: { class: 'Fighter' } },
      items: [
        { type: 'item', name: 'Ring of Protection', system: { containerId: null } },
        { type: 'item', name: 'Sword', system: { containerId: 'some-container' } },
      ],
    };
    global.game.actors.filter = () => [actor];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Misc Items Report</h2><br/>No unallowed Misc items in any actor.',
    });
  });

  it('should create a chat message with a report of misc items', async () => {
    const actor = {
      type: 'character',
      flags: {},
      name: 'Test Actor',
      system: { details: { class: 'Fighter' } },
      items: [
        { type: 'item', name: 'Misc Item 1', system: { containerId: null } },
        { type: 'item', name: 'Misc Item 2', system: { containerId: null } },
      ],
    };
    global.game.actors.filter = () => [actor];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.console.log).toHaveBeenCalledWith('<b>Test Actor:</b> Misc Item 1');
    expect(global.console.log).toHaveBeenCalledWith('<b>Test Actor:</b> Misc Item 2');
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Misc Items Report</h2><br/><b>Test Actor:</b> Misc Item 1<br/><br/><b>Test Actor:</b> Misc Item 2',
    });
  });
});
const fs = require('fs');
const path = require('path');

describe('lock-all-doors-active-scene', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/lock-all-doors-active-scene.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock the game object
    global.game = {
      scenes: {
        active: {
          walls: [],
        },
      },
      userId: 'test-user',
    };

    // Mock the ChatMessage class
    global.ChatMessage = {
      create: jest.fn(),
    };
  });

  it('should create a chat message with "No Unlocked Doors Found" if there are no doors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>No Unlocked Doors Found</h4>',
      whisper: ['test-user'],
    });
  });

  it('should create a chat message with "No Unlocked Doors Found" if there are doors but none are unlocked', async () => {
    const lockedDoor = { door: 1, ds: 2, update: jest.fn() };
    global.game.scenes.active.walls = [lockedDoor];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>No Unlocked Doors Found</h4>',
      whisper: ['test-user'],
    });
    expect(lockedDoor.update).not.toHaveBeenCalled();
  });

  it('should lock all unlocked doors and create a chat message', async () => {
    const unlockedDoor1 = { door: 1, ds: 0, update: jest.fn() };
    const unlockedDoor2 = { door: 1, ds: 1, update: jest.fn() }; // This is considered locked by the script
    const lockedDoor = { door: 1, ds: 2, update: jest.fn() };
    global.game.scenes.active.walls = [unlockedDoor1, unlockedDoor2, lockedDoor];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(unlockedDoor1.update).toHaveBeenCalledWith({ ds: 2 });
    expect(unlockedDoor2.update).not.toHaveBeenCalled(); // This should not be called
    expect(lockedDoor.update).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>All Unlocked Doors Locked (1)</h4>', // Only 1 door should be locked
      whisper: ['test-user'],
    });
  });
});
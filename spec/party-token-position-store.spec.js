
const fs = require('fs');
const path = require('path');

describe('party-token-position-store', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/party-token-position-store.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock the game object
    global.game = {
      scenes: {
        active: {
          tokens: {
            getName: jest.fn(),
          },
        },
      },
      userId: 'test-user',
    };

    // Mock the ChatMessage class
    global.ChatMessage = {
      create: jest.fn(),
    };
  });

  it('should create a chat message with "No Party token found" if no Party token is found', async () => {
    global.game.scenes.active.tokens.getName.mockResolvedValue(null);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: 'No Party token found in the current scene.',
      whisper: ['test-user'],
    });
  });

  it('should save Party token position and create a chat message if Party token is found', async () => {
    const partyToken = {
      x: 100,
      y: 200,
      flags: {},
      update: jest.fn(),
    };
    global.game.scenes.active.tokens.getName.mockResolvedValue(partyToken);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(partyToken.update).toHaveBeenCalledWith({ flags: { savedPosition: { x: 100, y: 200 } } });
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: 'Saved position of Party token at x: 100, y: 200',
      whisper: ['test-user'],
    });
  });
});

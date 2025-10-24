
const fs = require('fs');
const path = require('path');

describe('party-token-position-reset', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/party-token-position-reset.js'), 'utf8');
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

  it('should create a chat message with "No saved position found" if Party token has no saved position', async () => {
    const partyToken = {
      flags: {},
      update: jest.fn(),
    };
    global.game.scenes.active.tokens.getName.mockResolvedValue(partyToken);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(partyToken.update).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: 'No saved position found for the Party token.',
      whisper: ['test-user'],
    });
  });

  it('should reset Party token position and create a chat message if saved position exists', async () => {
    const partyToken = {
      flags: { savedPosition: { x: 100, y: 200 } },
      update: jest.fn(),
    };
    global.game.scenes.active.tokens.getName.mockResolvedValue(partyToken);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(partyToken.update).toHaveBeenCalledWith({ x: 100, y: 200 });
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: 'Reset position of Party token to saved position at x: 100, y: 200',
      whisper: ['test-user'],
    });
  });
});

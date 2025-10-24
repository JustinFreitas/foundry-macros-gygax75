const fs = require('fs');
const path = require('path');

describe('languages', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/languages.js'), 'utf8');
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
  });

  it('should create a chat message with "No actors in the party" if there are no party actors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>Party Languages</h4><br/>No actors in the party to list languages!',
      whisper: ['test-user'],
    });
  });

  it('should create a chat message with "No actors in the party" if there are party actors but no languages', async () => {
    global.game.actors.filter = () => [
      {
        flags: { ose: { party: true } },
        system: { languages: { value: [] } },
        name: 'Test Actor 1',
      },
    ];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>Party Languages</h4><br/>No actors in the party to list languages!',
      whisper: ['test-user'],
    });
  });

  it('should create a chat message with a list of languages and actors', async () => {
    global.game.actors.filter = () => [
      {
        flags: { ose: { party: true } },
        system: { languages: { value: ['Common', 'Elvish'] } },
        name: 'Test Actor 1',
      },
      {
        flags: { ose: { party: true } },
        system: { languages: { value: ['Common', 'Dwarvish'] } },
        name: 'Test Actor 2',
      },
    ];
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h4>Party Languages</h4><b>Common:</b>  Test Actor 1, Test Actor 2<br/><br/><b>Dwarvish:</b>  Test Actor 2<br/><br/><b>Elvish:</b>  Test Actor 1<br/>',
      whisper: ['test-user'],
    });
  });
});
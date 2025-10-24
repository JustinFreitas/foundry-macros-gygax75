const fs = require('fs');
const path = require('path');

describe('party-room-trap-check', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/party-room-trap-check.js'), 'utf8');
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

    // Mock the Roll class
    global.Roll = jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({ result: 1 }),
    }));
  });

  it('should create a chat message with "No actors in the party to search!" if there are no party actors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Party Room Trap Check</h2><br/>No actors in the party to search!',
      whisper: ['test-user'],
    });
  });

  it('should create a chat message with trap check results (no traps found)', async () => {
    const actor1 = {
      flags: { ose: { party: true } },
      name: 'Actor 1',
      system: { exploration: { ft: 1 }, details: { class: 'Fighter' } },
    };
    const actor2 = {
      flags: { ose: { party: true } },
      name: 'Actor 2',
      system: { exploration: { ft: 2 }, details: { class: 'Rogue' } },
    };
    global.game.actors.filter = (fn) => [actor1, actor2].filter(fn);
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 2 }) }));
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 3 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Party Room Trap Check</h2><b>Actor 1:</b>  roll: 2 chance: 1<br/><br/><b>Actor 2:</b>  roll: 3 chance: 2<br/>',
      whisper: ['test-user'],
    });
  });

  it('should create a chat message with trap check results (traps found)', async () => {
    const actor1 = {
      flags: { ose: { party: true } },
      name: 'Actor 1',
      system: { exploration: { ft: 3 }, details: { class: 'Fighter' } },
    };
    const actor2 = {
      flags: { ose: { party: true } },
      name: 'Actor 2',
      system: { exploration: { ft: 1 }, details: { class: 'Rogue' } },
    };
    global.game.actors.filter = (fn) => [actor1, actor2].filter(fn);
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 2 }) }));
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 1 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Party Room Trap Check</h2><b>Actor 1:</b>  roll: 2 chance: 3 - <b>Found a room trap!</b><br/><br/><b>Actor 2:</b>  roll: 1 chance: 1 - <b>Found a room trap!</b><br/>',
      whisper: ['test-user'],
    });
  });

  it('should filter out non-humanoid party actors', async () => {
    const humanoid = {
      flags: { ose: { party: true } },
      name: 'Humanoid',
      system: { details: { class: 'Fighter' }, exploration: { ft: 1 } },
    };
    const mule = {
      flags: { ose: { party: true } },
      name: 'Mule',
      system: { details: { class: 'Mule' }, exploration: { ft: 1 } },
    };
    global.game.actors.filter = (fn) => [humanoid, mule].filter(fn);
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 1 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Party Room Trap Check</h2><b>Humanoid:</b>  roll: 1 chance: 1 - <b>Found a room trap!</b><br/>',
      whisper: ['test-user'],
    });
  });
});
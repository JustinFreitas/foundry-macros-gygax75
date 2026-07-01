global.$ = (x) => x;

const fs = require('fs');
const path = require('path');

describe('party-secret-door-check', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/party-secret-door-check.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock the game object
    global.game = {
      actors: {
        filter: () => [],
      },
      userId: 'test-user',
      togglePause: jest.fn(),
    };

    // Mock the ChatMessage class
    global.ChatMessage = {
      create: jest.fn(),
      getWhisperRecipients: jest.fn().mockReturnValue(['test-user']),
    };

    // Mock the ui object
    global.ui = {
      notifications: {
        warn: jest.fn(),
      },
    };

    // Mock the Roll class
    global.Roll = jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({ result: 1 }),
    }));
  });

  it('should warn if there are no party actors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith("No actors in the party to search!");
  });

  it('should use the best chance in the party (standard)', async () => {
    const actor1 = {
      flags: { ose: { party: true } },
      name: 'Actor 1',
      system: { exploration: { sd: 1 }, details: { class: 'Fighter' } },
    };
    const actor2 = {
      flags: { ose: { party: true } },
      name: 'Actor 2', // Best chance
      system: { exploration: { sd: 2 }, details: { class: 'Rogue' } },
    };
    global.game.actors.filter = (fn) => [actor1, actor2].filter(fn);

    // Roll 2 (success for Actor 2, fail for Actor 1) - Should succeed because we take best
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 2 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('<b>Rolled:</b> 2 vs target 2 (Best: Actor 2)'),
    }));
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('<b>RESULT: Secret Door Found!</b>'),
    }));
    // expect(global.game.togglePause).toHaveBeenCalledWith(true, true);
  });

  it('should use the best chance in the party (elf houserule)', async () => {
    const actor1 = {
      flags: { ose: { party: true } },
      name: 'Elf',
      system: { exploration: { sd: 1 }, details: { class: 'Elf' } }, // Sheet says 1, Should be treated as 3
    };
    global.game.actors.filter = (fn) => [actor1].filter(fn);

    // Roll 3 (Success for target 3)
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 3 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('<b>Rolled:</b> 3 vs target 3 (Best: Elf)'),
    }));
    // expect(global.game.togglePause).toHaveBeenCalledWith(true, true);
  });

  it('should fail if roll is higher than best chance', async () => {
    const actor1 = {
      flags: { ose: { party: true } },
      name: 'Fighter',
      system: { exploration: { sd: 1 }, details: { class: 'Fighter' } },
    };
    global.game.actors.filter = (fn) => [actor1].filter(fn);

    // Roll 2 (Fail for target 1)
    global.Roll.mockImplementationOnce(() => ({ evaluate: jest.fn().mockResolvedValue({ result: 2 }) }));

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);

    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('<b>Rolled:</b> 2 vs target 1'),
    }));
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('RESULT: Secret Door Not Found'),
    }));
    expect(global.game.togglePause).not.toHaveBeenCalled();
  });
});

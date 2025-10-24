
const fs = require('fs');
const path = require('path');

describe('mount-encumbrance', () => {
  let scriptContent;

  // Function extracted from the script for isolated testing
  const getSpeed = (animal, fastRate, slowRate) => {
    return animal.system.encumbrance.value > animal.system.encumbrance.max ? 0
        : animal.system.encumbrance.value <= (animal.system.encumbrance.max / 2) ? fastRate : slowRate;
  };

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/mount-encumbrance.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock the game object
    global.game = {
      actors: {
          filter: () => [],
          search: () => []
      },
      userId: 'test-user',
    };

    // Mock the ChatMessage class
    global.ChatMessage = {
      create: jest.fn(),
    };
  });

  describe('getSpeed', () => {
    const animal = { system: { encumbrance: { value: 50, max: 100 } } };

    it('should return fastRate when encumbrance is half or less', () => {
      expect(getSpeed(animal, 240, 120)).toBe(240);
    });

    it('should return slowRate when encumbrance is more than half', () => {
      animal.system.encumbrance.value = 75;
      expect(getSpeed(animal, 240, 120)).toBe(120);
    });

    it('should return 0 when encumbrance is over max', () => {
      animal.system.encumbrance.value = 101;
      expect(getSpeed(animal, 240, 120)).toBe(0);
    });
  });

  it('should create a chat message with "No animal speeds were updated" if there are no party actors', async () => {
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<br/>No animal speeds were updated.',
    });
  });

  it('should create a chat message with "No animal speeds were updated" if there are no mounts', async () => {
    const actor = {
      flags: { ose: { party: true } },
      name: 'Test Actor',
      system: { details: { class: 'Fighter' } },
    };
    global.game.actors = {
        filter: () => [actor],
        search: () => []
    };
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<br/>No animal speeds were updated.',
    });
  });

  it('should update mount speeds and create a chat message', async () => {
    const humanoid = {
      flags: { ose: { party: true } },
      name: 'Test Humanoid',
      system: { details: { class: 'Fighter' } },
    };
    const ridingHorse = {
      name: 'Riding Horse (Test Humanoid)',
      system: {
        details: { class: 'Riding Horse' },
        encumbrance: { value: 50, max: 100 },
        movement: { base: 0 },
      },
      update: jest.fn(),
    };
    global.game.actors = {
        filter: (fn) => {
            if (fn.toString().includes('actor.flags.ose?.party === true')) {
                return [humanoid];
            }
            if (fn.toString().includes("actor.system.details.class === 'Mule'")) {
                return [];
            }
            if (fn.toString().includes("actor.system.details.class !== 'Mule'")) {
                return [humanoid];
            }
            return [];
        },
        search: () => [ridingHorse]
    };
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(ridingHorse.update).toHaveBeenCalledWith({ system: { movement: { base: 240 } } });
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: "<h2>Animal Speed Updates</h2><br/><b>Riding Horse (Test Humanoid) - Riding Horse:</b> Encumbrance is 50/100cns, movement is 240'.<br/><br/><b>Slowest speed is 240' / 48 miles.</b>",
    });
  });
});

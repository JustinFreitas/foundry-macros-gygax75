global.$ = (x) => x;

const fs = require('fs');
const path = require('path');

describe('selected-found-to-pile', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/selected-found-to-pile.js'), 'utf8');
  });

  beforeEach(() => {
    global.canvas = {
      tokens: {
        controlled: [],
      },
      scene: {
        tokens: [],
      },
    };
    global.game = {
      itempiles: {
        API: {
          transferItems: jest.fn(),
        },
      },
    };
    global.ui = {
      notifications: {
        warn: jest.fn(),
        info: jest.fn(),
      },
    };
    global.ChatMessage = {
      create: jest.fn(),
      getWhisperRecipients: jest.fn().mockReturnValue(['GM']),
    };
    global.console = {
      log: jest.fn(),
    };
  });

  it('should inform if no tokens are selected', async () => {
    global.canvas.tokens.controlled = [];
    await eval(scriptContent);
    expect(global.ui.notifications.info).toHaveBeenCalledWith('No tokens selected.');
  });

  it('should warn if multiple item pile tokens are selected', async () => {
    const pileToken1 = { actor: { id: 'p1', flags: { 'item-piles': { data: { enabled: true } } } } };
    const pileToken2 = { actor: { id: 'p2', flags: { 'item-piles': { data: { enabled: true } } } } };
    global.canvas.tokens.controlled = [pileToken1, pileToken2];

    await eval(scriptContent);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Expected at most 1 item pile in selection, but found 2.');
  });

  it('should warn if no pile is selected and 0 item piles exist on the scene', async () => {
    const heroToken = { actor: { id: 'h1', name: 'Hero 1', flags: {} } };
    global.canvas.tokens.controlled = [heroToken];
    global.canvas.scene.tokens = [heroToken];

    await eval(scriptContent);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Expected 1 item pile on the scene, but found 0.');
  });

  it('should warn if no pile is selected and multiple item piles exist on the scene', async () => {
    const heroToken = { actor: { id: 'h1', name: 'Hero 1', flags: {} } };
    const pileToken1 = { actor: { id: 'p1', flags: { 'item-piles': { data: { enabled: true } } } } };
    const pileToken2 = { actor: { id: 'p2', flags: { 'item-piles': { data: { enabled: true } } } } };
    global.canvas.tokens.controlled = [heroToken];
    global.canvas.scene.tokens = [heroToken, pileToken1, pileToken2];

    await eval(scriptContent);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Expected 1 item pile on the scene, but found 2.');
  });

  it('should inform if only the item pile is selected and no character tokens', async () => {
    const pileToken = { actor: { id: 'p1', name: 'Treasure Chest', flags: { 'item-piles': { data: { enabled: true } } } } };
    global.canvas.tokens.controlled = [pileToken];

    await eval(scriptContent);
    expect(global.ui.notifications.info).toHaveBeenCalledWith('No valid character tokens selected to transfer items from.');
  });

  it('should inform if selected tokens have no (Found) items', async () => {
    const pileActor = { id: 'p1', name: 'Treasure Chest', flags: { 'item-piles': { data: { enabled: true } } } };
    const heroActor = {
      id: 'h1',
      name: 'Hero 1',
      flags: {},
      items: [
        { id: 'item1', name: 'Regular Sword', system: { quantity: { value: 1 } } },
      ],
    };
    global.canvas.tokens.controlled = [{ actor: heroActor }];
    global.canvas.scene.tokens = [{ actor: heroActor }, { actor: pileActor }];

    await eval(scriptContent);
    expect(global.game.itempiles.API.transferItems).not.toHaveBeenCalled();
    expect(global.ui.notifications.info).toHaveBeenCalledWith('No items were transferred.');
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Item Transfer to Treasure Chest</h2><p>No (Found) items to transfer from <b>Hero 1</b>.</p>',
      whisper: ['GM'],
    });
  });

  it('should transfer found items from selected tokens when pile is on the scene', async () => {
    const pileActor = { id: 'p1', name: 'Treasure Chest', flags: { 'item-piles': { data: { enabled: true } } } };
    const heroActor1 = {
      id: 'h1',
      name: 'Hero 1',
      flags: {},
      items: [
        { id: 'item1', name: 'Ruby (Found)', system: { quantity: { value: 2 } } },
        { id: 'item2', name: 'Rations', system: { quantity: { value: 3 } } },
      ],
    };
    const heroActor2 = {
      id: 'h2',
      name: 'Hero 2',
      flags: {},
      items: [
        { id: 'item3', name: 'Gold (Found)', system: { quantity: { value: 50 } } },
      ],
    };

    global.canvas.tokens.controlled = [{ actor: heroActor1 }, { actor: heroActor2 }];
    global.canvas.scene.tokens = [{ actor: heroActor1 }, { actor: heroActor2 }, { actor: pileActor }];
    global.game.itempiles.API.transferItems.mockResolvedValue(true);

    await eval(scriptContent);

    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledWith(
      heroActor1,
      pileActor,
      [{ _id: 'item1', quantity: 2 }]
    );
    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledWith(
      heroActor2,
      pileActor,
      [{ _id: 'item3', quantity: 50 }]
    );
    expect(global.ui.notifications.info).toHaveBeenCalledWith('Item transfer complete!');
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Item Transfer to Treasure Chest</h2><p>Transferred the following from <b>Hero 1</b>:</p><ul><li>2 x Ruby (Found)</li></ul><p>Transferred the following from <b>Hero 2</b>:</p><ul><li>50 x Gold (Found)</li></ul>',
      whisper: ['GM'],
    });
  });

  it('should transfer found items when the item pile token is also in the selection (marquee select)', async () => {
    const pileActor = { id: 'p1', name: 'Treasure Chest', flags: { 'item-piles': { data: { enabled: true } } } };
    const heroActor = {
      id: 'h1',
      name: 'Hero 1',
      flags: {},
      items: [
        { id: 'item1', name: 'Jewelry (Found)', system: { quantity: { value: 1 } } },
      ],
    };

    // Both hero and pile are selected
    global.canvas.tokens.controlled = [{ actor: heroActor }, { actor: pileActor }];
    global.canvas.scene.tokens = [{ actor: heroActor }, { actor: pileActor }];
    global.game.itempiles.API.transferItems.mockResolvedValue(true);

    await eval(scriptContent);

    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledTimes(1);
    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledWith(
      heroActor,
      pileActor,
      [{ _id: 'item1', quantity: 1 }]
    );
    expect(global.ui.notifications.info).toHaveBeenCalledWith('Item transfer complete!');
  });

  it('should deduplicate actors if multiple tokens of the same actor are selected', async () => {
    const pileActor = { id: 'p1', name: 'Treasure Chest', flags: { 'item-piles': { data: { enabled: true } } } };
    const heroActor = {
      id: 'h1',
      name: 'Hero 1',
      flags: {},
      items: [
        { id: 'item1', name: 'Jewelry (Found)', system: { quantity: { value: 1 } } },
      ],
    };

    // Two tokens representing the same actor
    global.canvas.tokens.controlled = [{ actor: heroActor }, { actor: heroActor }];
    global.canvas.scene.tokens = [{ actor: heroActor }, { actor: pileActor }];
    global.game.itempiles.API.transferItems.mockResolvedValue(true);

    await eval(scriptContent);

    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledTimes(1);
  });
});

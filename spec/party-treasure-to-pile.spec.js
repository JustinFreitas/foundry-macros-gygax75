
const fs = require('fs');
const path = require('path');

describe('party-treasure-to-pile', () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/party-treasure-to-pile.js'), 'utf8');
  });

  beforeEach(() => {
    // Mock global objects and functions
    global.canvas = {
      scene: {
        tokens: {
          filter: jest.fn(),
        },
      },
    };
    global.game = {
      actors: {
        filter: jest.fn(),
      },
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

  it('should warn if no item pile token is found', async () => {
    global.canvas.scene.tokens.filter.mockReturnValue([]);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Expected 1 item pile on the scene, but found 0.');
    expect(global.game.actors.filter).not.toHaveBeenCalled();
  });

  it('should warn if multiple item pile tokens are found', async () => {
    global.canvas.scene.tokens.filter.mockReturnValue([{}, {}]);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Expected 1 item pile on the scene, but found 2.');
    expect(global.game.actors.filter).not.toHaveBeenCalled();
  });

  it('should inform if no party members are found', async () => {
    global.canvas.scene.tokens.filter.mockReturnValue([{ actor: { name: 'Item Pile', flags: { 'item-piles': { data: { enabled: true } } } } }]);
    global.game.actors.filter.mockReturnValue([]);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.ui.notifications.info).toHaveBeenCalledWith('No party members found.');
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  it('should inform if no items were transferred from party members', async () => {
    const itemPileActor = { name: 'Item Pile', flags: { 'item-piles': { data: { enabled: true } } } };
    const partyMember = {
      name: 'Party Member',
      flags: { ose: { party: true } },
      items: [
        { id: 'item1', name: 'Regular Item', system: { quantity: { value: 1 } } },
      ],
    };
    global.canvas.scene.tokens.filter.mockReturnValue([{ actor: itemPileActor }]);
    global.game.actors.filter.mockReturnValue([partyMember]);
    const script = `(async () => {${scriptContent}})()`;
    await eval(script);
    expect(global.game.itempiles.API.transferItems).not.toHaveBeenCalled();
    expect(global.ui.notifications.info).toHaveBeenCalledWith('No items were transferred.');
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Item Transfer to Item Pile</h2><p>No (Found) items to transfer from <b>Party Member</b>.</p>',
      whisper: ['GM'],
    });
  });

  it('should transfer items and create a chat message', async () => {
    const itemPileActor = { name: 'Item Pile', flags: { 'item-piles': { data: { enabled: true } } } };
    const partyMember = {
      name: 'Party Member',
      flags: { ose: { party: true } },
      items: [
        { id: 'item1', name: 'Treasure (Found)', system: { quantity: { value: 5 } } },
        { id: 'item2', name: 'Gold (Found)', system: { quantity: { value: 10 } } },
        { id: 'item3', name: 'Regular Item', system: { quantity: { value: 1 } } },
      ],
    };
    global.canvas.scene.tokens.filter.mockReturnValue([{ actor: itemPileActor }]);
    global.game.actors.filter.mockReturnValue([partyMember]);
    global.game.itempiles.API.transferItems.mockResolvedValue(true);

    const script = `(async () => {${scriptContent}})()`;
    await eval(script);

    expect(global.game.itempiles.API.transferItems).toHaveBeenCalledWith(
      partyMember,
      itemPileActor,
      [
        { _id: 'item1', quantity: 5 },
        { _id: 'item2', quantity: 10 },
      ]
    );
    expect(global.console.log).toHaveBeenCalledWith('Transferred 2 item stacks from Party Member to Item Pile.');
    expect(global.ui.notifications.info).toHaveBeenCalledWith('Item transfer complete!');
    expect(global.ChatMessage.create).toHaveBeenCalledWith({
      content: '<h2>Item Transfer to Item Pile</h2><p>Transferred the following from <b>Party Member</b>:</p><ul><li>5 x Treasure (Found)</li><li>10 x Gold (Found)</li></ul>',
      whisper: ['GM'],
    });
  });
});

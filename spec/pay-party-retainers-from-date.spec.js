const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/pay-party-retainers-from-date.js'), 'utf8');

describe('PayPartyRetainersFromDate', () => {
  beforeEach(() => {
    const bankItem = {
      name: 'GP (Bank)',
      system: { quantity: { value: 1000 } },
      update: jest.fn(),
    };

    const playerActor = {
      name: 'Player Character',
      type: 'character',
      flags: { ose: { party: true } },
      system: { details: { class: 'Fighter' }, retainer: { enabled: false } },
      items: {
        getName: jest.fn().mockReturnValue(bankItem),
      },
    };

    const retainerActor = {
      name: 'Retainer (Hireling) (Player Character)',
      type: 'character',
      flags: { ose: {} },
      system: {
        details: { class: 'Fighter' },
        retainer: { enabled: true, wage: '10gp' },
      },
      items: {
        getName: jest.fn().mockReturnValue({
          name: 'GP (Bank)',
          system: { quantity: { value: 50 } },
          update: jest.fn(),
        }),
      },
      getFlag: jest.fn(),
      setFlag: jest.fn(),
      createEmbeddedDocuments: jest.fn(),
    };

    global.game = {
      actors: {
        filter: jest.fn(callback => [playerActor, retainerActor].filter(callback)),
      },
      user: { id: '123' },
    };

    global.ChatMessage = {
      create: jest.fn(),
    };

    global.SimpleCalendar = {
      api: {
        timestamp: jest.fn(() => 1735689600), // 1/1/2025
        formatTimestamp: jest.fn(() => '1/10/2025'),
      },
    };

    global.ui = {
      notifications: {
        error: jest.fn(),
      },
    };
  });

  test('should pay retainers correctly for the specified period', async () => {
    const html = {
      find: jest.fn(() => [{ value: '1/1/2025' }]),
    };

    let capturedCallback;
    global.Dialog = jest.fn().mockImplementation((dialogData) => {
        capturedCallback = dialogData.buttons.calculate.callback;
        return {
            render: jest.fn()
        };
    });

    eval(macroScript);

    await capturedCallback(html);

    // Wait for async operations within the macro to complete
    await new Promise(process.nextTick);

    expect(ChatMessage.create).toHaveBeenCalled();
    const messageContent = ChatMessage.create.mock.calls[0][0].content;
    expect(messageContent).toContain('<h4>Retainer Payment Report</h4>');
    expect(messageContent).toContain('Paying for period from 1/1/2025 to 1/10/2025');
    expect(messageContent).toContain('<h4>Player Character</h4>');
    expect(messageContent).toContain('Paid <strong>Retainer (Hireling) (Player Character)</strong> 90gp for 9 days.');
  });
});

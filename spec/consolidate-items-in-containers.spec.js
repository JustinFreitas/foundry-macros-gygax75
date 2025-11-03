// Mocking FoundryVTT globals
global.canvas = {
  tokens: {
    controlled: [],
  },
};

global.ui = {
  notifications: {
    warn: jest.fn(),
    info: jest.fn(),
  },
};

// The script is self-executing, so we need to require it to run.
// We'll wrap it in a describe block to keep the tests organized.
describe('consolidateItemsInContainers', () => {
  // We're not actually testing any specific behavior here,
  // just that the script doesn't throw an error when run.
  it('should run without errors', () => {
    // We need to reset the mocks before each test
    global.canvas.tokens.controlled = [];
    global.ui.notifications.warn.mockClear();
    global.ui.notifications.info.mockClear();

    // The script is imported and executed here
    require('../scripts/consolidate-items-in-containers.js');

    // We can add some basic assertions to make sure the script ran
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('Please select at least one token.');
  });
});

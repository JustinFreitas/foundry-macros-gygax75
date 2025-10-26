import { itemRollStringUpdate } from "../scripts/sleep-roll-string-update";

describe("itemRollStringUpdate", () => {
  let mockItems;
  let mockUpdate;
  let mockNotifications;

  beforeEach(() => {
    mockUpdate = jest.fn();
    mockItems = [
      { name: "Sleep Powder", system: { roll: "4d4" }, update: mockUpdate },
      { name: "Fireball", system: { roll: "8d6" }, update: mockUpdate },
      { name: "Sleeping Draught", system: { roll: "4d4" }, update: mockUpdate },
      { name: "Arrow", system: { roll: "1d6" }, update: mockUpdate },
    ];

    global.game = {
      items: {
        filter: jest.fn((predicate) => mockItems.filter(predicate)),
      },
    };

    mockNotifications = {
      info: jest.fn(),
    };
    global.ui = {
      notifications: mockNotifications,
    };
  });

  it("should update items with 'Sleep' in the name and a roll string of '4d4'", async () => {
    await itemRollStringUpdate();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith({
      system: {
        roll: "2d8",
      },
    });
    expect(mockNotifications.info).toHaveBeenCalledWith("Updated 2 items.");
  });

  it("should not update items without 'Sleep' in the name or a different roll string", async () => {
    mockItems = [
      { name: "Fireball", system: { roll: "8d6" }, update: mockUpdate },
      { name: "Arrow", system: { roll: "1d6" }, update: mockUpdate },
    ];
    await itemRollStringUpdate();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNotifications.info).toHaveBeenCalledWith(
      "No items with a roll string of '4d4' and 'Sleep' in the name found."
    );
  });
});

/**
 * Goes through all items in the game and changes the system.roll string from '4d4' to '2d8'.
 *
*/

const itemsToUpdate = game.items.filter(
  (item) => item.system.roll === "4d4" && item.name.includes("Sleep")
);

if (!itemsToUpdate.length) {
  ui.notifications.info("No items with a roll string of '4d4' and 'Sleep' in the name found.");
} else {

  for (const item of itemsToUpdate) {
    item.update({
      system: {
        roll: "2d8",
      },
    });
  }

  ui.notifications.info(`Updated ${itemsToUpdate.length} items.`);
}

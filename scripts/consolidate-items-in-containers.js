/*
 * This script goes through the containers of the selected tokens' actors and consolidates items of the same name
 * into a single item with the sum of their quantities.
 *
 * It will process each selected actor's containers one by one.
 */

(async () => {
  const selectedTokens = canvas.tokens.controlled;
  if (selectedTokens.length === 0) {
    ui.notifications.warn("Please select at least one token.");
    return;
  }

  for (const token of selectedTokens) {
    const actor = token.actor;
    if (!actor) continue;

    const containers = actor.items.filter(item => item.type === 'container');
    if (containers.length === 0) {
      ui.notifications.info(`No containers found for ${actor.name}.`);
      continue;
    }

    let itemsUpdated = false;

    for (const container of containers) {
        console.log(`Processing container '${container.name}' for actor '${actor.name}'.`);
      const itemsInContainer = actor.items.filter(item => item.system.containerId === container.id);
      if (itemsInContainer.length === 0) continue;

      const itemsByName = itemsInContainer.reduce((acc, item) => {
        if (!acc[item.name]) {
          acc[item.name] = [];
        }
        acc[item.name].push(item);
        return acc;
      }, {});

      for (const name in itemsByName) {
        const items = itemsByName[name];
        console.log(`Processing ${items.length} items named '${name}' in container '${container.name}' for actor '${actor.name}'.`);
        if (items.length > 1) {
          itemsUpdated = true;
          const firstItem = items[0];
          const totalQuantity = items.reduce((sum, item) => sum + item.system.quantity.value, 0);

          await actor.updateEmbeddedDocuments("Item", [{ _id: firstItem.id, "system.quantity.value": totalQuantity }]);

          const idsToDelete = items.slice(1).map(item => item.id);
          await actor.deleteEmbeddedDocuments("Item", idsToDelete);
        }
      }
    }

    if (itemsUpdated) {
      ui.notifications.info(`Consolidated items for ${actor.name}.`);
    } else {
      ui.notifications.info(`No items to consolidate for ${actor.name}.`);
    }
  }
})();

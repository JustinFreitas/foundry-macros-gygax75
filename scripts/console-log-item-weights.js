game.items.forEach(item => {
    console.log(`Item: ${item.name}  Weight: ${item.system.weight ?? 0}`);
});

const allFoundItems = [];
game.actors.forEach(actor => {
    const foundItems = actor.items.filter(item => item.type === 'item' && item.name.includes('(Found)'));
    foundItems.forEach(item => {
        const found = `<b>${actor.name}:</b> ${item.name}`;
        console.log(found);
        allFoundItems.push(found);
    });
});

if (allFoundItems.length > 0) {
    ChatMessage.create({content: '<h2>Found Treasure Report</h2><br/>' + allFoundItems.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h2>Found Treasure Report</h2><br/>No (Found) items in any actor.'});
}

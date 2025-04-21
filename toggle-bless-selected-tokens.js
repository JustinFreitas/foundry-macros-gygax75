const BLESS_EFFECT_NAME = 't0R8wcEIg4ybbn3k';
const tokens = canvas.tokens.controlled;
const nameToBonusAndWeaponsTupleMap = new Map();
tokens.forEach(token => {
    const actor = token.actor;
    let bonus = actor.statuses.has(BLESS_EFFECT_NAME) ? -1 : 1;
    actor.toggleStatusEffect(BLESS_EFFECT_NAME);
    const weapons = [];
    // Alter bonus on weapons.
    actor.items.filter(i=>i.type==='weapon').forEach(item => {
        item.update({system: {bonus: item.system.bonus + bonus}});
        weapons.push(`${item.name} (${item.system.bonus + bonus})`);
    });

    nameToBonusAndWeaponsTupleMap.set(actor.name, { bonus: bonus, weapons: weapons });
});

if (nameToBonusAndWeaponsTupleMap.keys().toArray().length > 0) {
    const collatedItems = [];
    nameToBonusAndWeaponsTupleMap.keys().forEach(actorName => {
        const bonusAndWeaponsTuple = nameToBonusAndWeaponsTupleMap.get(actorName);
        const weaponsOutput = bonusAndWeaponsTuple.weapons.length > 0 ? bonusAndWeaponsTuple.weapons.sort().join(", ") : 'No weapons modified';
        const addingOrRemoving = bonusAndWeaponsTuple.bonus > 0 ? 'Adding' : 'Removing';
        collatedItems.push(`<b>${actorName}:</b>  ${addingOrRemoving} Bless.  ${weaponsOutput}.<br/>`);
    });

    ChatMessage.create({content: '<h2>Toggle Bless Report</h2>' + collatedItems.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Toggle Bless Report</h2>No tokens selected.'});
}

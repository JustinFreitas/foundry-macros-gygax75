const blessEffectId = CONFIG.statusEffects.find((el)=>el.name?.includes('Bless'))?.id || 'bless';
const tokens = canvas.tokens.controlled;
const nameToBonusAndWeaponsTupleMap = new Map();
for (const token of tokens) {
    const actor = token.actor;
    let bonus = actor.statuses.has(blessEffectId) ? -1 : 1;
    await actor.toggleStatusEffect(blessEffectId);
    const weapons = [];
    // Alter bonus on weapons.
    const actorWeapons = actor.items.filter(i => i.type === 'weapon');
    for (const item of actorWeapons) {
        await item.update({system: {bonus: item.system.bonus + bonus}});
        weapons.push(`${item.name} (${item.system.bonus})`);
    }

    nameToBonusAndWeaponsTupleMap.set(actor.name, { bonus: bonus, weapons: weapons });
}

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

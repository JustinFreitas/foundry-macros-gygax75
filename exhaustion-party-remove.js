const exhaustedEffectId = CONFIG.statusEffects.find((el)=>el.name?.includes('Exhausted'))?.id || 'downgrade';
const nameToBonusAndWeaponsTupleMap = new Map();
const bonus = 1;
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
for (const actor of partySheetActors) {
    if (!actor.flags.ose?.exhausted) { // Don't process if already exhausted.
        console.log(`Skipping ${actor.name} as not exhausted.`);
        continue;
    }

    console.log(`Removing exhaustion for ${actor.name}`);
    const weapons = [];
    // Alter bonus on weapons.
    const actorWeapons = actor.items.filter(i => i.type === 'weapon');
    for (const item of actorWeapons) {
        await item.update({system: {bonus: item.system.bonus + bonus}});
        weapons.push(`${item.name} (${item.system.bonus})`);
    }

    nameToBonusAndWeaponsTupleMap.set(actor.name, { bonus: bonus, weapons: weapons });
    actor.toggleStatusEffect(exhaustedEffectId, {active: false});
    await actor.update({flags: {ose: {exhausted: false}}});
}

if (nameToBonusAndWeaponsTupleMap.keys().toArray().length > 0) {
    const collatedItems = [];
    const actorNames = Array.from(nameToBonusAndWeaponsTupleMap.keys()).sort();
    for (const actorName of actorNames) {
        const bonusAndWeaponsTuple = nameToBonusAndWeaponsTupleMap.get(actorName);
        const weaponsOutput = bonusAndWeaponsTuple.weapons.length > 0 ? bonusAndWeaponsTuple.weapons.sort().join(", ") : 'No weapons modified';
        collatedItems.push(`<b>${actorName}:</b>  Removing exhaustion.  ${weaponsOutput}.<br/>`);    
    }

    ChatMessage.create({content: '<h4>Remove Exhaustion Report</h4>' + collatedItems.join('<br/>')});
} else {
    ChatMessage.create({content: '<h4>Remove Exhaustion Report</h4>No exhaustion was removed.  Either no party actors or none were exhausted.'});
}

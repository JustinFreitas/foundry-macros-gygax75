const exhaustedEffectId = CONFIG.statusEffects.find((el)=>el.name?.includes('Exhausted'))?.id || 'downgrade';
const nameToBonusAndWeaponsTupleMap = new Map();
const bonus = -1;  // Well, it's a penalty in this case.
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
for (const actor of partySheetActors) {
    if (actor.flags.ose?.exhausted) { // Don't process if already exhausted.
        console.log(`Skipping ${actor.name} as already exhausted.`);
        continue;
    }

    console.log(`Applying exhaustion for ${actor.name}`);
    const weapons = [];
    // Alter bonus on weapons.
    const actorWeapons = actor.items.filter(i => i.type === 'weapon');
    for (const item of actorWeapons) {
        await item.update({system: {bonus: item.system.bonus + bonus}});
        weapons.push(`${item.name} (${item.system.bonus})`);
    }

    nameToBonusAndWeaponsTupleMap.set(actor.name, { bonus: bonus, weapons: weapons });
    await actor.toggleStatusEffect(exhaustedEffectId, {active: true});
    await actor.update({flags: {ose: {exhausted: true}}});
}

if (nameToBonusAndWeaponsTupleMap.keys().toArray().length > 0) {
    const collatedItems = [];
    const actorNames = Array.from(nameToBonusAndWeaponsTupleMap.keys()).sort();
    for (const actorName of actorNames) {
        const bonusAndWeaponsTuple = nameToBonusAndWeaponsTupleMap.get(actorName);
        const weaponsOutput = bonusAndWeaponsTuple.weapons.length > 0 ? bonusAndWeaponsTuple.weapons.sort().join(", ") : 'No weapons modified';
        collatedItems.push(`<b>${actorName}:</b>  Applying exhaustion.  ${weaponsOutput}.<br/>`);    
    }

    ChatMessage.create({content: '<h4>Apply Exhaustion Report</h4>' + collatedItems.join('<br/>')});
} else {
    ChatMessage.create({content: '<h4>Apply Exhaustion Report</h4>No exhaustion was applied.  Either no party actors or all are already exhausted.'});
}

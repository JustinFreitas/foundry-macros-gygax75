// Character Name Format Check
// This script checks the names of all character actors to ensure they follow the required format.
// Player Characters (PCs) should be in the format: 'Character Name (Class)'
// Non-Player Characters (NPCs)/Retainers should be in the format: 'NPC Name (Class)(Employer Name)' for hired retainers
// (note: a space between class and employer is optional), or 'NPC Name (Class)' or 'NPC Name (Class)()' for unhired retainers.
// Special actors (Mules, etc.) can be 'Name (Class)' or 'Name (Employer)'.
// For Riding Horses and Floating Discs, the name in parentheses can also be an NPC/retainer.
//
// It performs the following checks:
// 1. For all characters, the class in parentheses must match the actor's class (with exceptions for special actors).
// 2. For hired NPCs, the employer name in the second set of parentheses must be a valid PC name.
// 3. For special actors with an employer/rider, the name must be a valid PC or NPC (for Riding Horses/Floating Discs) name.

function getCleanClassName(rawClassName) {
    const trimmed = rawClassName.trim();
    const withoutAsterisk = trimmed.replace(/\s*\*\s*$/, '').trim();
    if (withoutAsterisk === 'NH') {
        return 'Normal Human';
    }
    return withoutAsterisk;
}

const actorsToValidate = game.actors.filter(actor =>
    actor.type === 'character'
    && !actor.flags['item-piles']?.data?.enabled
    && !actor.name.match(/\s+chest\s*$/i)
    && !actor.name.match(/^\s*chest|party\s*$/i)
);

const specialClasses = ['Mule', 'Floating Disc', 'Riding Horse'];

const specialActors = actorsToValidate.filter(a => specialClasses.includes(a.system.details.class));
const nonSpecialActors = actorsToValidate.filter(a => !specialClasses.includes(a.system.details.class));

const pcs = nonSpecialActors.filter(a => !a.system.retainer?.enabled);
const npcs = nonSpecialActors.filter(a => a.system.retainer?.enabled);

const pcNames = pcs.map(a => {
    const match = a.name.match(/^\s*(.*?)\s*\(/);
    return match ? match[1].trim() : a.name.trim();
});

const npcNames = npcs.map(a => {
    const match = a.name.match(/^\s*(.*?)\s*\(/);
    return match ? match[1].trim() : a.name.trim();
});

const pcNameRegex = /^\s*(.*?)\s*\(([^)]+)\)\s*$/;
const npcNameRegex = /^\s*(.*?)\s*\(([^)]+)\)\s*\(([^)]*)\)\s*$/;

pcs.forEach(actor => {
    const name = actor.name;
    const actorClass = actor.system.details.class;

    const match = name.match(pcNameRegex);
    if (!match) {
        if (name.includes('(') || name.includes(')')) {
            console.log(`Bad Name Format for PC: '${name}'. Expected 'Name (Class)'.`);
        }
        return;
    }

    const charClassInName = getCleanClassName(match[2]);

    if (charClassInName !== actorClass) {
        console.log(`Class mismatch for PC '${name}': Name has '${charClassInName}', actor has '${actorClass}'.`);
    }
});

npcs.forEach(actor => {
    const name = actor.name;
    const actorClass = actor.system.details.class;

    const npcMatch = name.match(npcNameRegex);
    const pcMatch = name.match(pcNameRegex);

    if (npcMatch) { // Hired retainer or unhired with ()
        const charClassInName = getCleanClassName(npcMatch[2]);
        const employerName = npcMatch[3].trim();

        if (charClassInName !== actorClass) {
            console.log(`Class mismatch for NPC '${name}': Name has '${charClassInName}', actor has '${actorClass}'.`);
        }

        if (employerName && !pcNames.includes(employerName)) {
            console.log(`Invalid employer for NPC '${name}': '${employerName}' is not a valid PC.`);
        }
    } else if (pcMatch) { // Unhired retainer: Name (Class)
        const charClassInName = getCleanClassName(pcMatch[2]);

        if (charClassInName !== actorClass) {
            console.log(`Class mismatch for NPC '${name}': Name has '${charClassInName}', actor has '${actorClass}'.`);
        }
    } else { // Bad format
        if (name.includes('(') || name.includes(')')) {
            console.log(`Bad Name Format for NPC: '${name}'. Expected 'Name (Class)', 'Name (Class)()' or 'Name (Class)(Employer)'.`);
        }
    }
});

specialActors.forEach(actor => {
    const name = actor.name;
    const actorClass = actor.system.details.class;

    const match = name.match(pcNameRegex);
    if (!match) {
        if (name.includes('(') || name.includes(')')) {
            console.log(`Bad Name Format for Special Actor: '${name}'. Expected 'Name (Class)' or 'Name (Employer)'.`);
        }
        return;
    }

    const nameInParens = match[2].trim();

    // Check 1: Is it a valid PC name?
    if (pcNames.includes(nameInParens)) {
        return; // Success
    }

    // Check 2: If it's a Riding Horse or Floating Disc, is it a valid NPC name?
    if ((actorClass === 'Riding Horse' || actorClass === 'Floating Disc') && npcNames.includes(nameInParens)) {
        return; // Success
    }

    // Check 3: Is it the correct class name?
    const charClassInName = getCleanClassName(nameInParens);
    if (charClassInName === actorClass) {
        return; // Success
    }

    // If all checks fail, log an error
    if (actorClass === 'Riding Horse' || actorClass === 'Floating Disc') {
        console.log(`Invalid content in parentheses for '${name}': '${nameInParens}' is not a valid PC, NPC, or the correct class ('${actorClass}').`);
    } else {
        console.log(`Invalid content in parentheses for '${name}': '${nameInParens}' is neither a valid employer nor the correct class ('${actorClass}').`);
    }
});
function capitalizeWords(str) {
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function isNullOrUndefined(obj) {
    return typeof obj === "undefined" || obj === null;
}

const animalClasses = [
    { name: 'Mule', pattern: /\s*mule\s*/i },
    { name: 'Draft Horse', pattern: /\s*draft\s*horse\s*/i },
    { name: 'Riding Horse', pattern: /\s*riding\s*horse\s*/i },
    { name: 'War Horse', pattern: /\s*war\s*horse\s*/i }
];

const CHAR_NAME_PATTERN = /^\s*(?<name>.*?)\s*\(\s*(?<class>.*?)\s*\)(?:\s*\(\s*(?<employer>.*?)\s*\))?\s*$/;
const allMiscItems = [];
const nameToActorMap = new Map();
const seenBaseNames = new Set();

game.actors.filter(actor =>
    actor.type === 'character'
    && !actor.flags['item-piles']?.data?.enabled
    && !actor.name.match(/\s+chest\s*$/i)
    && !actor.name.match(/^\s*chest|party\s*$/i)
    && actor.hasPlayerOwner
    && !['Wagon', 'Chuckwagon', 'Floating Disc'].includes(actor.system.details.class)
    && !(actor.name === 'Golden Phoenixes' && !actor.system.details.class)
)
    .forEach(actor => {
        let isMount = false;
        const actorNameMatch = actor.name.match(CHAR_NAME_PATTERN);
        for (const cls of animalClasses) {
            if (!isMount && actor.system.details.class.match(cls.pattern)) {
                isMount = true;
                if (actor.system.details.class !== cls.name) {
                    console.log(`GOING TO UPDATE CLASS to ${cls.name} for ${actor.name}.`);
                    //actor.update({system: {details: {class: cls.name}}});
                }
            }
        }

        if (!actorNameMatch) {
            console.log(`Bad Name Format: '${actor.name}'`);
            return;
        }

        const { name, class: className, employer } = actorNameMatch.groups;

        // Uniqueness Check
        if (seenBaseNames.has(name.toLowerCase())) {
            console.log(`Duplicate Base Name found: '${name}' in '${actor.name}'`);
        } else {
            seenBaseNames.add(name.toLowerCase());
        }

        if (actor.system.retainer?.enabled && !employer && !isMount) {
            console.log(`Retainer missing employer: '${actor.name}'`);
        }
    });

if (allMiscItems.length > 0) {
    //ChatMessage.create({content: '<h2>Misc Items Report</h2><br/>' + allMiscItems.join('<br/><br/>')});
} else {
    //ChatMessage.create({content: '<h2>Misc Items Report</h2><br/>No unallowed Misc items in any actor.'});
}

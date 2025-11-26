
const CHAR_NAME_PATTERN = /^\s*(?<name>.*?)\s*\(\s*(?<class>.*?)\s*\)(?:\s*\(\s*(?<employer>.*?)\s*\))?\s*$/;
const seenBaseNames = new Set();

const actors = [
    { name: "Gandalf (Magic User)", system: { retainer: { enabled: false }, details: { class: "Magic User" } } },
    { name: "Frodo (Hobbit)(Gandalf)", system: { retainer: { enabled: true }, details: { class: "Hobbit" } } },
    { name: "Gandalf (White Wizard)", system: { retainer: { enabled: false }, details: { class: "White Wizard" } } }, // Duplicate base name
    { name: "Bill (Sam)", system: { retainer: { enabled: false }, details: { class: "Mule" } } }, // Animal
    { name: "BadName", system: { retainer: { enabled: false }, details: { class: "Fighter" } } },
    { name: "Retainer (Fighter)", system: { retainer: { enabled: true }, details: { class: "Fighter" } } }, // Missing employer
    { name: "Heir (Fighter*)", system: { retainer: { enabled: false }, details: { class: "Fighter*" } } } // Heir case
];

console.log("--- Testing Logic ---");

actors.forEach(actor => {
    const actorNameMatch = actor.name.match(CHAR_NAME_PATTERN);

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

    if (actor.system.retainer?.enabled && !employer && actor.system.details.class !== 'Mule') { // Simplified mount check for test
        console.log(`Retainer missing employer: '${actor.name}'`);
    }
});

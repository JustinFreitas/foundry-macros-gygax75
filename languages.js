const languageToActorsMap = new Map();
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
for (const actor of partySheetActors) {
    for (const lang of actor.system.languages.value) {
        languageToActorsMap.set(lang, [...languageToActorsMap.get(lang) ? languageToActorsMap.get(lang) : [], actor]);
    }
}

let content = '<h4>Party Languages</h4>'
if (languageToActorsMap.keys().toArray().length > 0) {
    const collatedResults = [];
    for (const language of languageToActorsMap.keys()) {
        const actors = languageToActorsMap.get(language).map(a => a.name).sort().join(', ');
        collatedResults.push(`<b>${language}:</b>  ${actors}<br/>`);
    }
    content = content + collatedResults.join('<br/>');
} else {
    content = `${content}<br/>No actors in the party to list languages!`;
}
await ChatMessage.create({
    content,
    whisper: [game.userId]
});

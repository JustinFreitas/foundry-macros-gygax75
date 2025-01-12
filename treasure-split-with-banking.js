const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const formHtml = [];
formHtml.push('<form>');
partyActors.forEach(actor => {
    formHtml.push(`
        <div class="form-group">
            <label>${actor.name}</label>
            <input type="number" class="character" />
        </div>
    `);
});

formHtml.push('</form>');

new Dialog({
    title: "Character Banking Additions",
    content: formHtml.join('\n'),
    buttons: {
        calculate: {
            label: "Process Banking",
            callback: (html) => {
                const BANK_NAME = 'GP (Bank)';
                const characters = html.find('input.character');
                const actorLogs = [];
                actorLogs.push('<h2>Character Treasure Split</h2>');
                for (let i = 0; i < characters.length; i++) {
                    const actor = partyActors[i];
                    const bankedGold = Math.max(0, characters[i].value);
                    const actorBank = actor.items.getName(BANK_NAME);
                    if (actorBank) {
                        if (bankedGold <= 0) {
                            actorLogs.push(`<b>${actor.name}:</b> No change.</br>`);
                        } else {
                            const currentGold = actorBank.system.quantity.value;
                            const newGold = currentGold + bankedGold;
                            actorBank.update({system: {quantity: {value: newGold}}});
                            actorLogs.push(newGold > currentGold ? `<b>${actor.name}:</b> Bank deposit from ${currentGold}gp to ${newGold}gp.</br>`
                                : `<b>${actor.name}:</b> No change.</br>`);
                        }
                    } else {
                        actorLogs.push(`<b>${actor.name}:</b> No bank named ${BANK_NAME}.</br>`);
                    }
                }

                const chatMessage = partyActors.length > 0 ? actorLogs.join('<br />') : 'No characters in party.';
                ChatMessage.create({
                    content: chatMessage
                });
            }
        },
        close: {
            label: "Close"
        }
    },
    default: "calculate"
}).render(true);

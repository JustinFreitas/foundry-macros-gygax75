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
    title: "Character Upkeep Deductions",
    content: formHtml.join('\n'),
    buttons: {
        calculate: {
            label: "Process Upkeep",
            callback: (html) => {
                const BANK_NAME = 'GP (Bank)';
                const characters = html.find('input.character');
                const actorLogs = [];
                actorLogs.push('<h2>Character Upkeep Report</h2>');
                for (let i = 0; i < characters.length; i++) {
                    const actor = partyActors[i];
                    const upkeepGold = characters[i].value;
                    const actorBank = actor.items.getName(BANK_NAME);
                    if (actorBank) {
                        if (upkeepGold <= 0) {
                            actorLogs.push(`${actor.name}: No change`);
                        } else {
                            const currentGold = actorBank.system.quantity.value;
                            const newGold = currentGold - upkeepGold;
                            actorBank.update({system: {quantity: {value: currentGold - upkeepGold}}});
                            actorLogs.push(newGold > 0 ? `${actor.name}: From ${currentGold} to ${newGold}`
                                                : `${actor.name}: From ${currentGold} to 0 (calculated: ${newGold})`);
                        }
                    } else {
                        actorLogs.push(`${actor.name}: No bank named ${BANK_NAME}`);
                    }
                }

                const chatMessage = partyActors.length > 0 ? actorLogs.join('<br />') : 'No characters in party';
                ChatMessage.create({
                    content: chatMessage,
                    whisper: ChatMessage.getWhisperRecipients("GM")
                });
            }
        },
        close: {
            label: "Close"
        }
    },
    default: "calculate"
}).render(true);

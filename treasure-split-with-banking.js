const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true && actor.system.details.class.toLowerCase() !== 'normal human');
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
            callback: async (html) => { // Added async for modern Foundry updates
                const BANK_NAME = 'GP (Bank)';
                const characters = html.find('input.character');
                const actorLogs = [];
                actorLogs.push('<h2>Character Treasure Split</h2>');
                
                // Using a loop that correctly matches the filtered partyActors array
                for (let i = 0; i < characters.length; i++) {
                    const actor = partyActors[i];
                    // Use parseFloat for robustness and Math.max(0, ...) to ensure non-negative deposit
                    const bankedGold = Math.max(0, parseFloat(characters[i].value) || 0); 
                    const actorBank = actor.items.getName(BANK_NAME);
                    
                    if (actorBank) {
                        if (bankedGold <= 0) {
                            actorLogs.push(`<b>${actor.name}:</b> No change.</br>`);
                        } else {
                            // Corrected property access for OSE Ruleset quantity (usually a number)
                            const currentGold = actorBank.system.quantity.value;
                            const newGold = currentGold + bankedGold;
                            
                            // Using await for the asynchronous update call
                            await actorBank.update({system: {quantity: {value: newGold}}});
                            
                            actorLogs.push(`<b>${actor.name}:</b> Bank deposit from ${currentGold}gp to ${newGold}gp.</br>`);
                        }
                    } else {
                        actorLogs.push(`<b>${actor.name}:</b> No bank named ${BANK_NAME}.</br>`);
                    }
                }

                const chatMessage = partyActors.length > 0 ? actorLogs.join('<br />') : 'No eligible characters in party.';
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
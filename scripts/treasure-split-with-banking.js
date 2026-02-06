/* 
 * treasure-split-with-banking.js
 * Analyzed and Refactored
 */
const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true && actor.system.details.class.toLowerCase() !== 'normal human');
const formHtml = [];

formHtml.push('<form>');
partyActors.forEach(actor => {
    formHtml.push(`
        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
            <label style="flex: 2;">${actor.name}</label>
            <input type="number" name="${actor.id}" class="character-deposit" style="flex: 1;" placeholder="0" />
        </div>
    `);
});
formHtml.push('</form>');

new Dialog({
    title: "Character Banking Additions",
    content: formHtml.join(''),
    buttons: {
        calculate: {
            label: "Process Banking",
            callback: async (html) => {
                const BANK_NAME = 'GP (Bank)';
                const inputs = html.find('input.character-deposit');
                const updates = [];
                const logs = ['<h2>Character Treasure Split</h2>'];

                for (let input of inputs) {
                    const actorId = input.name;
                    const actor = game.actors.get(actorId); // Safer lookup
                    const amount = Math.max(0, parseFloat(input.value) || 0);

                    if (!actor || amount === 0) {
                        if (actor && amount === 0) logs.push(`<b>${actor.name}:</b> No deposit.`);
                        continue;
                    }

                    const actorBank = actor.items.getName(BANK_NAME);

                    if (actorBank) {
                        const currentGold = actorBank.system.quantity.value;
                        const newGold = currentGold + amount;

                        // Push update promise to array for parallel execution
                        updates.push(actorBank.update({ system: { quantity: { value: newGold } } }));
                        logs.push(`<b>${actor.name}:</b> Bank deposit ${amount}gp (${currentGold} ➔ ${newGold}).`);
                    } else {
                        logs.push(`<b>${actor.name}:</b> <span style="color:red">Missing bank item '${BANK_NAME}'.</span>`);
                    }
                }

                if (updates.length > 0) {
                    await Promise.all(updates);
                    ChatMessage.create({ content: logs.join('<br>') });
                } else {
                    ui.notifications.info("No deposits passed.");
                }
            }
        },
        close: { label: "Close" }
    },
    default: "calculate"
}).render(true);
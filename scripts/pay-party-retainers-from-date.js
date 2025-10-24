if (document?.getElementById('start-date')) {
    console.log('Date Input Window Already Open');
} else {
    const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true && actor.system.details?.class !== 'Mule');
    const formHtml = [];
    let currentGameDate;
    if (typeof SimpleCalendar !== 'undefined') {
        const currentTimestamp = SimpleCalendar.api.timestamp();
        currentGameDate = SimpleCalendar.api.formatTimestamp(currentTimestamp, 'MM/DD/YYYY');
    } else {
        currentGameDate = 'SimpleCalendar Not Found';
    }

    formHtml.push(`
<form>
    <div class="form-group">
        <label>Start Date</label>
        <input type="text" id="start-date" placeholder="Enter start date M/D/YY"></input>
    </div>
    <div>
        <p>Current Game Date:  ${currentGameDate}</p>
    </div>
`);
    formHtml.push('</form>');
    const pcsInParty = partyActors.filter(actor => !actor.system.retainer?.enabled);
    const retainersInGame = game.actors.filter(actor => actor.type === 'character' && actor.system.retainer?.enabled && actor.system.details?.class !== 'Mule');
    
    new Dialog({
        title: "Pay All PC Retainers From Date",
        content: formHtml.join('\n'),
        buttons: {
            calculate: {
                label: "Pay Retainers",
                callback: async (html) => {
                    const BANK_NAME = 'GP (Bank)';
                    const startDateString = html.find('#start-date')[0].value;
                    if (!startDateString) {
                        ui.notifications.error("Please enter a start date.");
                        return;
                    }

                    const userStartDate = new Date(startDateString);
                    if (isNaN(userStartDate.getTime())) {
                        ui.notifications.error("Invalid or ambiguous date format. Please enter a valid date.");
                        return;
                    }

                    const currentTimestamp = SimpleCalendar.api.timestamp();
                    const currentDate = new Date(SimpleCalendar.api.formatTimestamp(currentTimestamp, 'MM/DD/YYYY'));

                    const chatLogs = [];
                    chatLogs.push('<h4>Retainer Payment Report</h4>');
                    chatLogs.push(`<p>Paying for period from ${userStartDate.toLocaleDateString()} to ${currentDate.toLocaleDateString()}.</p>`);

                    for (const actor of pcsInParty) {
                        const actorLogs = [];
                        const actorBank = actor.items.getName(BANK_NAME);
                        
                        const baseActorName = actor.name.split('(')[0].trim();
                        
                        let retainersPaid = 0;
                        let hasRetainers = false;
                        for (const retainer of retainersInGame) {
                            const retainerMasterRegex = /\(([^)]+)\)\s*\(([^)]+)\)/;
                            const retainerMatch = retainer.name.match(retainerMasterRegex);
                            if (retainerMatch && retainerMatch[2] === baseActorName) {
                                hasRetainers = true;
                                const paidThroughDate = retainer.getFlag('ose', 'paidThroughDate') ? new Date(retainer.getFlag('ose', 'paidThroughDate')) : null;
                                const startDate = paidThroughDate && paidThroughDate > userStartDate ? paidThroughDate : userStartDate;

                                const timeDiff = currentDate.getTime() - startDate.getTime();
                                const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                                if (dayDiff <= 0) {
                                    actorLogs.push(`<strong>${retainer.name}</strong> is already paid up to date.</br>`);
                                    continue;
                                }

                                const regexRate = /(?<rate>\d+)gp/;
                                const matchRate = retainer.system.retainer?.wage?.match(regexRate);
                                if (matchRate?.groups?.rate) {
                                    const retainerWage = parseInt(matchRate.groups.rate);
                                    const upkeepCost = retainerWage * dayDiff;

                                    if (actorBank) {
                                        const currentMasterGold = Math.ceil(+actorBank.system.quantity.value);
                                        if (currentMasterGold >= upkeepCost) {
                                            retainersPaid++;
                                            const newMasterGold = Math.ceil(currentMasterGold - upkeepCost);
                                            await actorBank.update({system: {quantity: {value: newMasterGold}}});

                                            let retainerBank = retainer.items.getName(BANK_NAME);
                                            if (!retainerBank) {
                                                const itemData = {
                                                    name: BANK_NAME,
                                                    type: 'item',
                                                    system: {
                                                        quantity: { value: 0 },
                                                        weight: 0
                                                    }
                                                };
                                                await retainer.createEmbeddedDocuments('Item', [itemData]);
                                                retainerBank = retainer.items.getName(BANK_NAME);
                                            }
                                            const currentRetainerGold = Math.ceil(+retainerBank.system.quantity.value);
                                            const newRetainerGold = currentRetainerGold + upkeepCost;
                                            await retainerBank.update({ system: { quantity: { value: newRetainerGold } } });
                                            await retainer.setFlag('ose', 'paidThroughDate', currentDate.toDateString());

                                            actorLogs.push(`Paid <strong>${retainer.name}</strong> ${upkeepCost}gp for ${dayDiff} days. New balance: ${newRetainerGold}gp.</br>`);
                                        } else {
                                            actorLogs.push(`Could not pay <strong>${retainer.name}</strong> ${upkeepCost}gp. Bank balance of ${currentMasterGold}gp is insufficient.</br>`);
                                        }
                                    } else {
                                        actorLogs.push(`Could not pay for retainers. No bank ledger named ${BANK_NAME}.</br>`);
                                    }
                                }
                            }
                        }
                        if (hasRetainers) {
                           actorLogs.unshift(`<h4>${actor.name}</h4>`);
                           if (retainersPaid > 0) {
                                actorLogs.push(`New bank balance for ${actor.name}: ${actor.items.getName(BANK_NAME).system.quantity.value}gp.`);
                           }
                           chatLogs.push(actorLogs.join(''));
                        }
                    }

                    const chatMessage = pcsInParty.length > 0 ? chatLogs.join('') : 'No characters in party';
                    ChatMessage.create({
                        content: chatMessage,
                    });
                }
            },
            close: {
                label: "Close"
            }
        },
        default: "calculate"
    }).render(true);
}


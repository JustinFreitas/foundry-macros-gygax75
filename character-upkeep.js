if (document?.getElementById('sheet-data')) {
    console.log('Upkeep Input Window Already Open');
} else {
    const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
    const formHtml = [];
    formHtml.push(`
<script type="text/javascript">
    function findCharacterInSheet(twoDimensionalArray, nameToFind) {
        for (let row = 0; row < twoDimensionalArray.length; row++) {
            for (let col = 0; col < twoDimensionalArray[row].length; col++) {
                if (twoDimensionalArray[row][col] === nameToFind) {
                    return {row: row, col: col};
                }
            }
        }

        return undefined;
    }

    function findUpkeepForCharacterInSheet(twoDimensionalArray, nameToFind, defaultValue) {
        const characterCoords = findCharacterInSheet(twoDimensionalArray, nameToFind);
        if (characterCoords === undefined) {
            return defaultValue;
        }

        return twoDimensionalArray[characterCoords.row + 20][characterCoords.col + 1].split('gp')[0].trim();
    }

    function onPasteTextArea() {
        // Use setTimeout so that the pasted text can actually get there before referencing it.
        setTimeout(() => {
            const sheetDataRaw = document.getElementById('sheet-data').value;
            const sheetDataGrid = sheetDataRaw.split(\'\\n\').map(line => line.split(\'\\t\'));
            const partyActors = document.getElementsByClassName('actor-name');
            const characters = document.querySelectorAll('input.character');
            for (let i = 0; i < characters.length; i++) {
                const actor = partyActors[i];
                if (actor) {
                    const baseActorName = actor.innerText.split('(')[0].trim();
                    characters[i].value = findUpkeepForCharacterInSheet(sheetDataGrid, baseActorName, '');
                    console.log('Setting upkeep for ' + baseActorName + ' to ' + characters[i].value);
                }
            }
        }, 0);
    }
</script>
<form>
    <div class="form-group">
        <label>Sheet Data</label>
        <textarea id="sheet-data" rows="4" placeholder="Paste all Characters in World spreadsheet data here, otherwise, use number fields below." onpaste="onPasteTextArea()"></textarea>
    </div>
    <div>
        <p>To initialize the upkeep values for the party actors below, you can paste the Characters in the world spreadsheet data in the text area above.
        Go to sheet and Ctrl-A to select all, then Ctrl-C to copy the sheet data.  Then come here, click in the text area, and press Ctrl-V to paste.
        The fields should initialize with the data from the sheet.</p>
    </div>
`);

    partyActors.filter(actor => !actor.system.retainer?.enabled)
               .forEach(actor => {
                    formHtml.push(`
                    <div class="form-group">
                        <label class="actor-name">${actor.name}</label>
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
                    const retainedActors = partyActors.filter(actor => !actor.system.retainer?.enabled);
                    const actorLogs = [];
                    actorLogs.push('<h2>Character Upkeep Report</h2>');
                    for (let i = 0; i < characters.length; i++) {
                        const actor = retainedActors[i];
                        let bankedGold = characters[i].value;
                        const actorBank = actor.items.getName(BANK_NAME);
                        const boldActorName = `<strong>${actor.name}</strong>`;
                        if (actorBank) {
                            if (bankedGold === undefined || bankedGold === '' || bankedGold <= 0) {
                                actorLogs.push(`${boldActorName}: No Downtime Cost.<br/>`);
                            } else {
                                bankedGold = Math.ceil(+bankedGold);
                                const currentGold = Math.ceil(+actorBank.system.quantity.value);
                                const newGold = Math.ceil(currentGold - bankedGold);
                                actorBank.update({system: {quantity: {value: newGold}}});
                                actorLogs.push(newGold > 0 ? `${boldActorName}: Cost of living <b>${bankedGold}gp</b>. Bank balance changed from ${currentGold}gp to ${newGold}gp.<br/>`
                                    : `${boldActorName}: Cost of living <b>${bankedGold}gp</b>. Bank balance changed from ${currentGold}gp to 0 (calculated: ${newGold}).<br/>`);
                            }
                        } else {
                            actorLogs.push(`${boldActorName}: No bank ledger named ${BANK_NAME}<br/>`);
                        }
                    }

                    const chatMessage = partyActors.length > 0 ? actorLogs.join('<br/>') : 'No characters in party';
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

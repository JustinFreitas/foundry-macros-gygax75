const table = await fromUuid("RollTable.nXkdf8jgq9aSCn4x");
await table?.draw({ rollMode: CONST.DICE_ROLL_MODES.BLIND });

const table = await fromUuid("RollTable.9NU0tsECnVxnCJTS");
await table?.draw({ rollMode: CONST.DICE_ROLL_MODES.BLIND });

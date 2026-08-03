const table = await fromUuid("RollTable.pYg3UR8dMfRStEre");
await table?.draw({ rollMode: CONST.DICE_ROLL_MODES.BLIND });

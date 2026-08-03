const table = await fromUuid("RollTable.PIS0HvUwMwFHdKaU");
await table?.draw({ rollMode: CONST.DICE_ROLL_MODES.PRIVATE });

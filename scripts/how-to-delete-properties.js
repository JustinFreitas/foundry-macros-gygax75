/**
 * HOW TO DELETE PROPERTIES IN FOUNDRY VTT
 *
 * This script demonstrates the syntax for deleting properties from actor data.
 *
 * API:
 * To delete a key, you prefix the key with "-=" and set the value to null.
 * Example: { "system.details.-=biography": null }
 *
 * WARNING:
 * Foundry interprets dots in keys as nested paths.
 * - "items.0.img" refers to the 'img' property of the item at index 0 of the 'items' array.
 * - "-=items.0.img": null will DELETE the image of that valid item.
 *
 * IF YOU HAVE A LITERAL DOTTED KEY (e.g. { "items.0.img": "bad value" } inside the object root):
 * You cannot easily target it with update() because of the ambiguity.
 * The safest way to fix corrupted keys that shadow valid paths is often to:
 * 1. Get the parent object.
 * 2. Delete the bad key in your local copy.
 * 3. Update the PARENT key with the clean object.
 */

// EXAMPLE 1: Standard Deletion (Safe for normal properties)
// Uncomment to run
/*
const actor = game.actors.getName("My Actor");
if (actor) {
    // This deletes the 'biography' field from system.details
    actor.update({
        "system.details.-=biography": null
    });
    console.log("Deleted biography.");
}
*/

// EXAMPLE 2: Dangerous Path Deletion (Do NOT run unless you intend to delete the nested value)
/*
const actor = game.actors.getName("Zombie Snake-Priestess");
if (actor) {
    // This would delete the image of the first item!
    // actor.update({
    //     "items.0.-=img": null
    // });
}
*/

// EXAMPLE 3: Safe "Repair" of an object with bad keys
// Use this if you actually find keys like "items.0.img" sitting at the root level of 'system'
/*
const actor = game.actors.getName("Zombie Snake-Priestess");
if (actor) {
    const systemData = actor.system.toObject();
    let changed = false;

    // Check for bad keys at the root of system
    Object.keys(systemData).forEach(key => {
        if (key.includes('.')) {
            console.warn(`Removing corrupted key '${key}'`);
            delete systemData[key];
            changed = true;
        }
    });

    if (changed) {
        // Replace the ENTIRE system object to ensure bad keys are gone
        // Note: This can be heavy if system data is huge, but it's safe from ambiguity
        actor.update({ system: systemData });
        console.log("Repaired actor system data.");
    } else {
        console.log("No corrupted keys found in system root.");
    }
}
*/

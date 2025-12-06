const MODULE_NAME = 'ose-advancedfantasy';
const FORGE_URL_PREFIX = 'https://assets.forge-vtt.com';

game.actors.forEach(actor => {
    // Access the token image from prototypeToken.texture.src
    const img = actor.prototypeToken?.texture?.src;

    if (img && img.includes(MODULE_NAME) && img.startsWith(FORGE_URL_PREFIX)) {
        const modulesIndex = img.indexOf('modules/');
        if (modulesIndex !== -1) {
            const newPath = img.substring(modulesIndex);
            console.log(`[Actor: ${actor.name} (Token)] Replace '${img}' with '${newPath}'`);

            // Uncomment the following line to apply changes
            // actor.update({
            //     prototypeToken: {
            //         texture: {
            //             src: newPath
            //         }
            //     }
            // });
        }
    }
});

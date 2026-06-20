if(OSRH.util.singleSelected()){
    const id = canvas.tokens.controlled[0].actor.id;
    OSRH.light.turnsRemaining(id);
}

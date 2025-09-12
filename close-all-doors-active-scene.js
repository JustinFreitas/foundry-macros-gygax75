game.scenes.active.walls.filter(w=>!!w.door && !!w.ds).forEach(w=>w.update({ds:0}));

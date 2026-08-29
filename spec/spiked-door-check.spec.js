const fs = require("fs");
const path = require("path");

const macroScript = fs.readFileSync(
    path.resolve(__dirname, "../scripts/spiked-door-check.js"),
    "utf8"
);

function makeDoor({ spiked = true, door = 1 } = {}) {
    const flags = { ose: { spiked } };
    return {
        document: {
            door,
            getFlag: jest.fn((scope, key) => flags?.[scope]?.[key]),
            unsetFlag: jest.fn((scope, key) => {
                if (flags[scope]) delete flags[scope][key];
            })
        }
    };
}

// Roll mock whose total is driven by a queue so each test controls the d6.
function mockRollQueue(totals) {
    const queue = [...totals];
    global.Roll = jest.fn().mockImplementation(function () {
        this.evaluate = jest.fn().mockResolvedValue({ total: queue.shift() });
        return this;
    });
}

async function runMacro() {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(macroScript)();
}

describe("Spiked Door Check Macro", () => {
    beforeEach(() => {
        global.game = {
            canvas: { walls: { placeables: [] } },
            userId: "gm1"
        };
        global.ChatMessage = {
            _created: [],
            create: jest.fn(function (m) {
                this._created.push(m);
            })
        };
    });

    test("reports no spiked doors when none are flagged", async () => {
        game.canvas.walls.placeables = [makeDoor({ spiked: false })];
        mockRollQueue([]);
        await runMacro();

        const msg = ChatMessage._created[0];
        expect(msg.content).toContain("No spiked doors on this scene.");
        expect(msg.whisper).toEqual(["gm1"]);
        expect(Roll).not.toHaveBeenCalled();
    });

    test("ignores non-door walls even if flagged", async () => {
        const wall = makeDoor({ spiked: true, door: 0 }); // door:0 = not a door
        game.canvas.walls.placeables = [wall];
        mockRollQueue([]);
        await runMacro();

        expect(ChatMessage._created[0].content).toContain("No spiked doors");
        expect(wall.document.unsetFlag).not.toHaveBeenCalled();
    });

    test("a roll of 1 fails the spikes and clears the flag", async () => {
        const door = makeDoor({ spiked: true });
        game.canvas.walls.placeables = [door];
        mockRollQueue([1]);
        await runMacro();

        expect(door.document.unsetFlag).toHaveBeenCalledWith("ose", "spiked");
        expect(ChatMessage._created[0].content).toContain("spikes failed!");
    });

    test("a roll above 1 holds and keeps the flag", async () => {
        const door = makeDoor({ spiked: true });
        game.canvas.walls.placeables = [door];
        mockRollQueue([4]);
        await runMacro();

        expect(door.document.unsetFlag).not.toHaveBeenCalled();
        expect(ChatMessage._created[0].content).toContain("holds.");
    });

    test("rolls once per spiked door and reports each", async () => {
        game.canvas.walls.placeables = [makeDoor(), makeDoor(), makeDoor()];
        mockRollQueue([1, 3, 1]);
        await runMacro();

        expect(Roll).toHaveBeenCalledTimes(3);
        const content = ChatMessage._created[0].content;
        expect((content.match(/Door roll/g) || []).length).toBe(3);
    });
});

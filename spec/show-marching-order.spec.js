const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/show-marching-order.js'), 'utf8');

global.game = {
    actors: {
        filter: jest.fn()
    }
};

global.ui = {
    notifications: {
        warn: jest.fn()
    }
};

global.ChatMessage = {
    create: jest.fn()
};

function actor(id, name, marchingOrder) {
    const ose = { party: true };
    if (marchingOrder !== undefined) ose.marchingOrder = marchingOrder;
    return { id, name, type: 'character', flags: { ose } };
}

// The HTML content passed to ChatMessage.create on the last call.
function chatContent() {
    return ChatMessage.create.mock.calls[0][0].content;
}

describe("Show Marching Order Macro", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("warns and posts nothing when the party is empty", () => {
        game.actors.filter.mockReturnValue([]);
        eval(macroScript);
        expect(ui.notifications.warn).toHaveBeenCalledWith(
            "There are no characters currently in your OSE Party Sheet!"
        );
        expect(ChatMessage.create).not.toHaveBeenCalled();
    });

    test("single file lists characters in marching order, front to back", () => {
        game.actors.filter.mockReturnValue([
            actor('a3', 'Cleric', 3),
            actor('a1', 'Fighter', 1),
            actor('a2', 'Thief', 2)
        ]);
        eval(macroScript);

        const content = chatContent();
        // The <ol> supplies numbering, so items are bare names (no manual "1.").
        expect(content).toContain('<li>Fighter</li>');
        expect(content).toContain('<li>Thief</li>');
        expect(content).toContain('<li>Cleric</li>');
        expect(content).not.toMatch(/<li>\d+\.\s/); // no duplicated manual numbers
        // Front-to-back ordering is preserved in the HTML.
        expect(content.indexOf('<li>Fighter</li>')).toBeLessThan(content.indexOf('<li>Thief</li>'));
        expect(content.indexOf('<li>Thief</li>')).toBeLessThan(content.indexOf('<li>Cleric</li>'));
    });

    test("double file puts each rank member on its own line, both labelled with the rank", () => {
        game.actors.filter.mockReturnValue([
            actor('a1', 'Fighter', 1),
            actor('a2', 'Thief', 2),
            actor('a3', 'Cleric', 3),
            actor('a4', 'Wizard', 4)
        ]);
        eval(macroScript);

        const content = chatContent();
        expect(content).toContain('<div>Rank 1: Fighter</div>');
        expect(content).toContain('<div>Rank 1: Thief</div>');
        expect(content).toContain('<div>Rank 2: Cleric</div>');
        expect(content).toContain('<div>Rank 2: Wizard</div>');
        // Both members of a rank are separate lines, not one wrapping line.
        expect(content).not.toContain('&amp;');
    });

    test("triple file groups three abreast per rank, partial final rank allowed", () => {
        game.actors.filter.mockReturnValue([
            actor('a1', 'Fighter', 1),
            actor('a2', 'Thief', 2),
            actor('a3', 'Cleric', 3),
            actor('a4', 'Wizard', 4),
            actor('a5', 'Ranger', 5)
        ]);
        eval(macroScript);

        const content = chatContent();
        const triple = content.slice(content.indexOf('Triple File'));
        // Rank 1 = first three, Rank 2 = remaining two (partial).
        expect(triple).toContain('<div>Rank 1: Fighter</div>');
        expect(triple).toContain('<div>Rank 1: Thief</div>');
        expect(triple).toContain('<div>Rank 1: Cleric</div>');
        expect(triple).toContain('<div>Rank 2: Wizard</div>');
        expect(triple).toContain('<div>Rank 2: Ranger</div>');
        // No third rank for 5 characters.
        expect(triple).not.toContain('Rank 3:');
    });

    test("odd party leaves the last character alone in its double-file rank", () => {
        game.actors.filter.mockReturnValue([
            actor('a1', 'Fighter', 1),
            actor('a2', 'Thief', 2),
            actor('a3', 'Cleric', 3)
        ]);
        eval(macroScript);

        const content = chatContent();
        expect(content).toContain('<div>Rank 1: Fighter</div>');
        expect(content).toContain('<div>Rank 1: Thief</div>');
        // Trailing odd character occupies its own rank, with only one line.
        expect(content).toContain('<div>Rank 2: Cleric</div>');
        const rank2Lines = (content.match(/Rank 2:/g) || []).length;
        expect(rank2Lines).toBe(1);
    });

    test("unset marching order falls to the back, ties broken by id", () => {
        game.actors.filter.mockReturnValue([
            actor('zzz', 'NoOrderZ'),          // unset -> 999
            actor('aaa', 'NoOrderA'),          // unset -> 999, lower id wins tie
            actor('a1', 'Leader', 1)
        ]);
        eval(macroScript);

        const content = chatContent();
        // Single-file list order reflects the sort.
        expect(content.indexOf('Leader')).toBeLessThan(content.indexOf('NoOrderA'));
        expect(content.indexOf('NoOrderA')).toBeLessThan(content.indexOf('NoOrderZ'));
    });

    test("escapes HTML in character names", () => {
        game.actors.filter.mockReturnValue([
            actor('a1', '<b>Sir & "Bold"</b>', 1)
        ]);
        eval(macroScript);

        const content = chatContent();
        expect(content).toContain('&lt;b&gt;Sir &amp; &quot;Bold&quot;&lt;/b&gt;');
        expect(content).not.toContain('<b>Sir');
    });
});

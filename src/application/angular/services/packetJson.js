/*
 * The JSON packet files a player (with worn items and mount) can be loaded from, as my_web_wow's
 * UsePlayerJsonData / PlayerJsonFileName (GlobalSettings.cs) and WorldObjectManager.LoadPacketsFromFile
 * (WorldObjectManager.Packets.cs). They are the captured and hand-made packet files next to the sources
 * (src/application), fetched from the page's server - the webpack dev server serves the repository root.
 * The hand-made mock files have // comments and trailing commas, which C# reads leniently and so does
 * parseLenientJson; webpack's json import could not take them.
 */

/* the packet files, as the C#'s list of selectable files plus the other packet captures */
export const playerJsonFiles = [
    "player.json",                          // original captured packet (character + items + mount)
    "mock_character_items_mount.json",      // human in the Wrath plate set on a flying proto-drake mount
    "mock_skeleton_thunderfury.json",       // SkeletonNaked model wielding Thunderfury, no mount
    "mock_skeleton_thunderfury_2.json",
    "mock_skeleton_apostle_of_argus.json",
    "mock_skeleton_vengeful_staff.json",
    "mock_skeleton_merciless.json",
    "mock_skeleton_sulfuras.json",
    "mock_skeleton_slayer.json",
    "mock_skeleton_other.json",
    "mock_skeleton_other_2.json",
    "mock_undead_skyshatter_thunderfury.json",
    "player2.json",
    "player3.json",
    "player3_rag.json",
    "rag_no_mount.json",
    "penguin.json",
    "npc_wood.json",
    "packet.json",
    "proto.json",
];

/*
 * JSON.parse with // and block comments and trailing commas allowed (C#'s JsonCommentHandling.Skip and
 * AllowTrailingCommas): the comments and the commas before a closing bracket are removed outside of
 * strings first.
 */
export function parseLenientJson(text) {
    var out = '';
    var i = 0;
    var n = text.length;
    while (i < n) {
        var ch = text[i];
        if (ch === '"') {
            // a string, copied as it is (with its escapes)
            var start = i++;
            while (i < n && text[i] !== '"') {
                if (text[i] === '\\') i++;
                i++;
            }
            out += text.substring(start, ++i);
        } else if (ch === '/' && text[i + 1] === '/') {
            while (i < n && text[i] !== '\n') i++;
        } else if (ch === '/' && text[i + 1] === '*') {
            var end = text.indexOf('*/', i + 2);
            i = end < 0 ? n : end + 2;
        } else if (ch === ',') {
            // drop it when only whitespace / comments come before the closing bracket
            var j = i + 1;
            while (j < n) {
                if (/\s/.test(text[j])) j++;
                else if (text[j] === '/' && text[j + 1] === '/') { while (j < n && text[j] !== '\n') j++; }
                else if (text[j] === '/' && text[j + 1] === '*') { var e = text.indexOf('*/', j + 2); j = e < 0 ? n : e + 2; }
                else break;
            }
            if (text[j] !== '}' && text[j] !== ']') out += ch;
            i++;
        } else {
            out += ch;
            i++;
        }
    }
    return JSON.parse(out);
}

/* a packet file's packets, or null (logged) when it cannot be loaded or is not a packet list */
export async function loadPacketJson(fileName) {
    var url = new URL('src/application/' + fileName, window.location.href).toString();
    try {
        var response = await fetch(url);
        if (!response.ok) {
            console.log("[WorldObjectManager] Packet JSON not found: " + url + " (" + response.status + ")");
            return null;
        }
        var root = parseLenientJson(await response.text());
        if (!Array.isArray(root)) {
            console.log("[WorldObjectManager] Packet JSON root is not an array: " + url);
            return null;
        }
        return root;
    } catch (e) {
        console.log("[WorldObjectManager] Failed to load packets from " + url + ": " + e.message);
        return null;
    }
}

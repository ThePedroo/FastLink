declare namespace _default {
    export { connectNode };
    export { handleRaw };
    export { createPlayer };
    export { getPlayer };
    export { getAllPlayers };
    export { getAllQueues };
    export { decodeTrack };
}
export default _default;
export type musicInfo = {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string;
    sourceName: string;
};
export type searchObject = {
    loadType: string;
    playlistInfo: {
        name: string;
        selectedTrack: number;
    } | {};
    tracks: Array<musicInfo>;
    exception: {
        message: string;
        exception: string;
    } | undefined;
};
/**
 * @typedef {{ identifier: string, isSeekable: boolean, author: string, length: number, isStream: boolean, position: number, title: string, uri: string, sourceName: string }} musicInfo
 * @typedef {{ loadType: string, playlistInfo: { name: string, selectedTrack: number } | {}, tracks: Array<musicInfo>, exception: { message: string, exception: string } | undefined }} searchObject
 */
/**
 * Connects on a Lavalink node.
 * @param {{ hostname: string, password: string, port: number, secure: boolean }[]} nodes - Lavalink node's informations.
 * @param {{ market: string, shards: number, botId: string | number, handleQueue: boolean }} infos - Connected bot informations.
 * @param {Function} [sPayload] - The function that the library will execute to send payloads to Discord.
 * @returns {Error | undefined} Will error if informations are invalid.
 */
declare function connectNode(nodes: {
    hostname: string;
    password: string;
    port: number;
    secure: boolean;
}[], infos: {
    market: string;
    shards: number;
    botId: string | number;
    handleQueue: boolean;
}, sPayload?: Function): Error | undefined;
/**
 * Handles Discord raw payloads, is it necessary for use play function.
 * @param {object} data Handles Discord payloads informations.
 * @returns {Error | undefined} Will error if it fails to send messages to Lavalink.
 */
declare function handleRaw(data: object): Error | undefined;
/**
 * Creates a player on a guild.
 * @param {object} config Informations for create the player.
 * @returns PlayerFunctions
 */
declare function createPlayer(config: object): PlayerFunctions;
/**
 * Gets a existing player from a guild.
 * @param {number} guildId guildId of the player's guild.
 * @returns PlayerFunctions
 */
declare function getPlayer(guildId: number): PlayerFunctions;
/**
 * Get all players saved on cache.
 * @returns Players map
 */
declare function getAllPlayers(): any;
/**
 * Get all queues saved on cache, handleQueue must be enabled.
 * @returns Queue map
 */
declare function getAllQueues(): any;
/**
 * Decoded a track, and returns it's music info.
 * @param {string} track - Track that will be decoded into the music informations.
 * @returns {musicInfo} The informations about the music.
 */
declare function decodeTrack(track: string): musicInfo;
declare class PlayerFunctions {
    /**
     * @param {object} config - Informations about the player.
     */
    constructor(config: object);
    /** @type {{ guildId: number, voiceChannelId: number }} */
    config: {
        guildId: number;
        voiceChannelId: number;
    };
    /**
     * Connects to a Discord voice channel.
     * @param mute - Join the voice channel muted, not recommended.
     * @param deaf - Join the voice channel deafed, recommended.
     */
    connect(mute?: boolean, deaf?: boolean): void;
    /**
     * Starting playing a music or adds a music to the queue.
     * @param {string} track The track of the music that will be played.
     * @param {boolean} noReplace If it's gonna replace the music current playing.
     * @returns {Error | undefined} Will error if track is invalid or if fails to send play payload to the Lavalink.
     */
    play(track: string, noReplace?: boolean): Error | undefined;
    /**
     * Starts playing a playlist or add all playlist tracks to the queue. 100+ tracks will take some time.
     * @param {string} track The track of the music that will be played.
     * @returns {Error | undefined} Will error if track is invalid or if fails to send play payload to the Lavalink.
     */
    playPlaylist(track: string): Error | undefined;
    /**
     * Searchs for a music, playlist, album, episode and etc.
     * @param {string} music URL or music name that the Lavalink will search.
     * @returns searchObject
     */
    search(music: string): any;
    /**
     * Skips the music, handleQueue must be enabled.
     * @returns {undefined} Will not give you a response.
     */
    skip(): undefined;
    /**
     * Stop playing the music, doesn't destroy the player.
     * @returns {Error | undefined} Will error if fails to send stop payload to the Lavalink.
     */
    stop(): Error | undefined;
    /**
     * Destroys a players, it will leave the voice channel and clear guild queue.
     * @returns {Error | undefined} Will error if fails to send destroy payload to the Lavalink.
     */
    destroy(): Error | undefined;
    /**
     * Changes the player's track volume.
     * @param {number} volume The volume that will be set for this track.
     * @returns {Error | undefined} Will error if volume is invalid or if fails to send volume payload to the Lavalink.
     */
    setVolume(volume: number): Error | undefined;
    /**
     * Pauses or resumes a player track.
     * @param {boolean} pause true for pause, false for resume. Default is false.
     * @returns {Error | undefined} Will error if pause is invalid or if fails to send pause payload to the Lavalink.
     */
    setPaused(pause?: boolean): Error | undefined;
    /**
     * Removes a track from the queue, if position == 0, it will remove and skip music.
     * @param {number} position The position of the track on the queue.
     * @returns {Error | undefined} Will error if position is invalid, if there is no track with the specified position or if the queue is empty.
     */
    removeTrack(position: number): Error | undefined;
    /**
     * Gets the guild player's queue.
     * @returns {Array<object> | object} The queue of the guild.
     */
    getQueue(): Array<object> | object;
}

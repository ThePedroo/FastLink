'use strict'

import Utils from './utils.js'

const Event = Utils.getEvent()

import WebSocket from 'ws'

const map = new Map()

let Infos = { Configs: {}, Nodes: {}, sendDiscordPayload: null }

/**
 * @typedef {{ loadType: string, playlistInfo: { name: string, selectedTrack: number } | {}, tracks: Array<musicInfo>, exception: { message: string, exception: string } | undefined }} searchObject
 */

/**
 * @typedef {{ identifier: string, isSeekable: boolean, author: string, length: number, isStream: boolean, position: number, title: string, uri: string, sourceName: string }} musicInfo
 */

/**
 * Connects on a Lavalink node(s).
 * @typedef {Object} ConnectNode - Connects to the Lavalink node and setup all the library.
 * @property {{ hostname: string, password: string, port: number, secure: boolean }[]} nodes - The Lavalink nodes informations used for connect to it.
 * @property {{ market: string, shards: number, botId: string | number, autoQueue: boolean }} informations - The informations abouut your bot and etc.
 * @property {Function} sendDiscordPayload - For connect to the voice channel without your library handle it.
 * @param {ConnectNode} object - The informations that will be used to connect to the Lavalink and play a music.
 * @returns {Error | undefined} Will error if informations are invalid.
 */
function connectNodes(object) {
  if (!object || !Array.isArray(object.nodes) || Object(object.informations) != object.informations)
    throw new Error(`${Array.isArray(object.nodes) ? 'nodes key must be an array' : Object(object) === object ? 'informations key must be an object' : ''}.`)

  if (object.nodes.length == 0)
    throw new Error('First parameter must be an array with at least one object in it.')

  if (object.informations.market && typeof object.informations.market != 'string')
    throw new Error('Info\'s market must be a string.')

  if (typeof object.informations.shards != 'number')
    throw new Error('Info\'s shards field must be a number.')

  if (typeof object.informations.botId != 'string' && object.informations.botId != 'number')
    throw new Error('Info\'s botId field must be a string or a number.')

  if (object.informations.reconnect) {
    if (object.informations.reconnect.tries && typeof object.informations.reconnect.tries != 'number')
      throw new Error('Info\'s reconnect tries must be a number.')

    if (object.informations.reconnect.timeout && typeof object.informations.reconnect.timeout != 'number')
      throw new Error('Info\'s reconnect timeout must be a number.')
  }

  if (!object.sendDiscordPayload || typeof object.sendDiscordPayload != 'function')
    throw new Error('sendDiscordPayload key must be a function.')

  Infos.sendDiscordPayload = object.sendDiscordPayload

  Infos.Configs = {
    'SpotifyMarket': object.informations.market || 'US',
    'UserId': object.informations.botId,
    'Queue': object.informations.autoQueue || false,
    'MaxTries': object.informations.reconnect?.tries || 5,
    'Delay': object.informations.reconnect?.timeout || 10000
  }

  Utils.makeRequest('https://open.spotify.com/get_access_token', {
    headers: {},
    method: 'GET',
    port: 443
  }).then((spotify) => Infos.Configs.SpotifyToken = spotify.accessToken)

  object.nodes.forEach((node) => {
    if (typeof node.hostname != 'string')
      throw new Error('node\'s hostname field must be a string.')
    if (typeof node.secure != 'boolean')
      throw new Error('node\'s secure field must be a boolean.')
    if (node.port && typeof node.port != 'number' || node.port > 65535 || node.port < 0)
      throw new Error('node\'s port field must be a number from the range of 0 to')
    if (node.password && typeof node.password != 'string')
      throw new Error('node\'s password must be a string.') 

    let ws = new WebSocket(`${node.secure ? 'wss://' : 'ws://'}${node.hostname}${node.port != undefined ? `:${node.port}` : ''}/v4/websocket`, undefined, {
      headers: {
        Authorization: node.password,
        'Num-Shards': object.informations.shards,
        'User-Id': object.informations.botId,
        'Client-Name': 'Fastlink@1.4.1'
      }
    })

    Infos.Nodes[`${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`] = { ws: ws, password: node.password, port: node.port || 443, stats: {}, reconnects: 0 }

    ws.on('open', () => Utils.onOpen(Infos, ws, node))
    ws.on('close', (code) => {
      let res = Utils.onClose(code, ws, Infos, map, node, object.informations)
      Infos = res.Infos
      ws = res.ws
    })
    ws.on('error', (error) => Utils.onError(error, node))
    ws.on('message', (data) => {
      Infos = Utils.onMessage(data, Infos, map, node)
    })
  })
  
  return Event
}

function getRecommendedNode() {
  let node = Object.values(Infos.Nodes).filter((node) => node.ws?._readyState === 1).sort((a, b) => a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0 - b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0)[0]

  if (!node) throw new Error('There are no nodes online.')

  return node
}

function makeSpotifyRequest(endpoint) {
  return new Promise((resolve) => {
    Utils.makeRequest(`https://api.spotify.com/v1${endpoint}`, {
      headers: { 'Authorization': `Bearer ${Infos.Configs.SpotifyToken}` },
      method: 'GET',
      port: 443
    }).then((res) => {
      if (res.error?.status === 401) {
        Utils.makeRequest('https://open.spotify.com/get_access_token', {
          headers: {}, 
          method: 'GET',
          port: 443
        }).then((spotify) => {
          Infos.Configs.SpotifyToken = spotify.accessToken

          makeSpotifyRequest(endpoint).then((res) => {
            return resolve(res)
          })
        })
      }

      return resolve(res)
    })
  })
}

/**
 * Handles Discord raw payloads, is it necessary for use play function.
 * @param {object} data Handles Discord payloads informations.
 * @returns {Error | undefined} Will error if it fails to send messages to Lavalink.
 */
function handleRaw(data) {
  setImmediate(() => {
    switch (data.t) {
      case 'VOICE_SERVER_UPDATE': {
        let sessionIDs = map.get('sessionIDs') || {}
        let players = map.get('players') || {}
  
        if (sessionIDs[data.d.guild_id]) {
          Utils.makeRequest(`${players[data.d.guild_id].ssl ? 'https://' : 'http://'}${players[data.d.guild_id].node}/v4/sessions/${Infos.Nodes[players[data.d.guild_id].node].sessionId}/players/${data.d.guild_id}`, {
            headers: {
              Authorization: Infos.Nodes[players[data.d.guild_id].node].password,
              'Content-Type': 'application/json',
              'Client-Name': 'FastLink'
            },
            body: {
              voice: {
                token: data.d.token,
                endpoint: data.d.endpoint,
                sessionId: sessionIDs[data.d.guild_id]
              }
            },
            method: 'PATCH',
            port: Infos.Nodes[players[data.d.guild_id].node].port
          })
  
          delete sessionIDs[data.d.guild_id]
  
          map.set('sessionIds', sessionIDs)
        }
        break
      }
      case 'VOICE_STATE_UPDATE': {
        let sessionIDs = map.get('sessionIDs') || {}
        sessionIDs[data.d.guild_id] = data.d.session_id

        if (data.d.member.user.id === Infos.Configs.UserId) map.set('sessionIDs', sessionIDs)
        break
      }
    }
  })
}

/**
 * Get all Lavalink Nodes (stats) information
 * @returns All Lavalink stats
 */

function getAllLavalinkStats() {
  return Infos.Nodes
}

/**
 * Creates a player on a guild.
 * @param {object} config Informations for create the player.
 * @returns PlayerFunctions
 */

function createPlayer(config) {
  if (config && typeof config != 'object') throw new Error('createPlayer parameter must be a object with guildId and voiceChannelId keys.')
  if (typeof config.guildId != 'string' && typeof config.guildId != 'number') throw new Error('guildId field must be a string or a number.')
  if (typeof config.voiceChannelId != 'string' && typeof config.voiceChannelId != 'number') throw new Error('voiceChannelId field must be a string or a number.')

  let players = map.get('players') || {}

  let nodeUrl = getRecommendedNode().ws._url

  players[config.guildId] = { voiceChannelId: config.voiceChannelId, playing: false, paused: false, node: nodeUrl.replace('ws://', '').replace('wss://', '').replace('/v4/websocket', ''), ssl: nodeUrl.startsWith('wss://') }
  map.set('players', players)

  return (new PlayerFunctions(config))
}

/**
 * Gets a existing player from a guild.
 * @param {number} guildId guildId of the player's guild.
 * @returns PlayerFunctions
 */

function getPlayer(guildId) {
  if (typeof guildId != 'string' && typeof guildId != 'number') throw new Error('guildId field must be a string or a number.')

  let guildPlayer = map.get('players') || {}
  
  if (guildPlayer[guildId]) return (new PlayerFunctions({ guildId, voiceChannelId: guildPlayer[guildId].voiceChannelId }))
}

/**
 * Get all players saved on cache.
 * @returns Players map
 */

function getAllPlayers() {
  return map.get('players') || {}
}

/**
 * Get all queues saved on cache, handleQueue must be enabled.
 * @returns Queue map
 */

function getAllQueues() {
  if (Infos.Configs.Queue) return map.get('queue') || {}
}

class PlayerFunctions {
  /**
   * @param {object} config - Informations about the player.
   */
  constructor(config) {
    this.config = config
    Object.freeze(this.config)
  }

  async makeLavalinkRequest(type, options) {
    let data;
    switch (type) {
      case 'custom': {
        let players = map.get('players') || {}
        data = await Utils.makeRequest(`${players[this.config.guildId].ssl ? 'https://' : 'http://'}${players[this.config.guildId].node}/v4/sessions/${Infos.Nodes[players[this.config.guildId].node].sessionId}/players/${this.config.guildId}?noReplace=${options.noReplace || 'false'}`, {
          headers: {
            Authorization: Infos.Nodes[players[this.config.guildId].node].password,
            'Content-Type': 'application/json',
            'Client-Name': 'FastLink',
            'User-Agent': 'https'
          },
          body: options.body,
          method: 'PATCH',
          port: Infos.Nodes[players[this.config.guildId].node].port
        })
        break;
      }
      case 'search': {
        let players = map.get('players') || {}
        data = await Utils.makeRequest(`${players[this.config.guildId].ssl ? 'https://' : 'http://'}${players[this.config.guildId].node}/v4/loadtracks?identifier=${options.identifier.startsWith('https://') ? encodeURI(options.identifier) : 'ytsearch:' + encodeURI(options.identifier)}`, {
          headers: {
            Authorization: Infos.Nodes[players[this.config.guildId].node].password,
            'Content-Type': 'application/json',
            'Client-Name': 'FastLink',
            'User-Agent': 'https'
          },
          method: 'GET',
          port: Infos.Nodes[players[this.config.guildId].node].port
        })
        break;
      }
      case 'play': {
        data = await this.makeLavalinkRequest('custom', {
          body: {
            encodedTrack: options.track
          }
        })
        break;
      }
      case 'stop': {
        data = await this.makeLavalinkRequest('custom', {
          body: {
            encodedTrack: null
          }
        })
        break;
      }
      case 'destroy': {
        let players = map.get('players') || {}
        data = await Utils.makeRequest(`${players[this.config.guildId].ssl ? 'https://' : 'http://'}${players[this.config.guildId].node}/v4/sessions/${Infos.Nodes[players[this.config.guildId].node].sessionId}/players/${this.config.guildId}`, {
          headers: {
            Authorization: Infos.Nodes[players[this.config.guildId].node].password,
            'Content-Type': 'application/json',
            'Client-Name': 'FastLink',
            'User-Agent': 'https'
          },
          method: 'DELETE',
          port: Infos.Nodes[players[this.config.guildId].node].port
        })
        break;
      }
      case 'volume': {
        data = await this.makeLavalinkRequest('custom', {
          body: {
            volume: options.volume
          }
        })
        break;
      }
      case 'pause': {
        data = await this.makeLavalinkRequest('custom', {
          body: {
            paused: options.pause
          }
        })
        break;
      }
      case 'filter': {
        data = await this.makeLavalinkRequest('custom', {
          body: {
            filters: options.filter
          }
        })
        break;
      }
      case 'decodetrack': {
        let players = map.get('players') || {}
        data = await Utils.makeRequest(`${players[this.config.guildId].ssl ? 'https://' : 'http://'}${players[this.config.guildId].node}/v4/decodetrack?encodedTrack=${options.track}`, {
          headers: {
            Authorization: Infos.Nodes[players[this.config.guildId].node].password,
            'Content-Type': 'application/json',
            'Client-Name': 'FastLink',
            'User-Agent': 'https'
          },
          method: 'GET',
          port: Infos.Nodes[players[this.config.guildId].node].port
        })
        break;
      }
    }
  
    if (data.error) throw new Error(data.error)
    else return data
  }

  /**
   * Connects to a Discord voice channel.
   * @param mute - Join the voice channel muted, not recommended.
   * @param deaf - Join the voice channel deafed, recommended.
   */
  connect(mute = false, deaf = true) {
    Infos.sendDiscordPayload(
      this.config.guildId,
      JSON.stringify({
        op: 4,
        d: {
          guild_id: this.config.guildId,
          channel_id: this.config.voiceChannelId,
          self_mute: mute,
          self_deaf: deaf
        }
      })
    )
  }

  /**
   * Starting playing a music or adds a music to the queue.
   * @param {string} track The track of the music that will be played.
   * @param {boolean} noReplace If it's gonna replace the music current playing.
   * @returns {Error | undefined} Will error if track is invalid or if fails to send play payload to the Lavalink.
   */
  play(track, noReplace = false) {
    if (typeof track != 'string') throw new Error('track parameter must be a string.')

    let players = map.get('players') || {}
    
    if (players[this.config.guildId]) {
      if (players[this.config.guildId].node) {
        players[this.config.guildId] = { ...players[this.config.guildId], playing: true, track, paused: false }
      } else {
        Utils.debug('Recommended node for a player was disconnected, finding new recommended node.')
        
        let url = new URL(getRecommendedNode().ws._url)
        
        players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false, node: url.host }   
      }
    }
      
    if (Infos.Configs.Queue) {
      let queue = map.get('queue') || {}

      if (queue[this.config.guildId] && queue[this.config.guildId][0]) queue[this.config.guildId].push(track)
      else {    
        queue[this.config.guildId] = [ track ]
   
        this.makeLavalinkRequest('play', {
          track,
          noReplace
        })
      }

      map.set('queue', queue)
    } else {
      this.makeLavalinkRequest('play', {
        track,
        noReplace
      })
    }

    map.set('players', players)
  }

  /**
   * Starts playing a playlist or add all playlist tracks to the queue. 100+ tracks will take some time.
   * @param {string} track The track of the music that will be played.
   * @returns {Error | undefined} Will error if track is invalid or if fails to send play payload to the Lavalink.
   */
  playPlaylist(track) {
    if (Infos.Configs.Queue) {
      if (!track || typeof track != 'object') throw new Error('track parameter must be an object.')

      let queue = map.get('queue') || {}
      let players = map.get('players') || {}
        
      if (queue[this.config.guildId]) {
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.encoded))
      } else {
        queue[this.config.guildId] = []
        this.makeLavalinkRequest('play', { track: track.tracks[0].encoded })
  
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.encoded))

        players[this.config.guildId] = { ...players[this.config.guildId], playing: true, paused: false }
        map.set('players', players)
      }
      
      map.set('queue', queue)
    } else {
      throw new Error('Cannot play a playlist. autoQueue === false.')
    }
  }

  /**
   * Searchs for a music, playlist, album, episode and etc.
   * @param {string} music URL or music name that the Lavalink will search.
   * @returns {searchObject} Returns the result of the search.
   */
  search(music) {
    return new Promise((resolve) => {
      let spotifyRegex = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|artist|episode|show|album)[/:]([A-Za-z0-9]+)/
      let deezerRegex = /^https?:\/\/(?:www\.)?deezer\.com\/(track|album|playlist)\/(\d+)$/
      
      if (spotifyRegex.test(music)) {
        let track = spotifyRegex.exec(music)

        console.log(track[1])

        let end; 
        switch (track[1]) {
          case 'track': { end = `/tracks/${track[2]}`; break }
          case 'playlist': { end = `/playlists/${track[2]}`; break }
          case 'album': { end = `/albums/${track[2]}`; break }
          case 'episodes': { end = `/episodes/${track[2]}?market=${Infos.Configs.SpotifyMarket}`; break }
          case 'show': { end = `/shows/${track[2]}?market=${Infos.Configs.SpotifyMarket}`; break }
          default: {
            return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
          }
        }

        makeSpotifyRequest(end).then(async (x) => {
          console.log(x)
          if (x.error?.status === 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
          if (x.error) return resolve({ loadType: 'LOAD_FAILED', playlistInfo: {}, tracks: [], exception: { message: x.error.message, severity: 'UNKNOWN' } })

          switch (track[1]) {
            case 'track': {
              this.makeLavalinkRequest('search', { identifier: `${x.name} ${x.artists[0].name}` }).then((res) => {
                console.log(res)
                if (res.loadType != 'SEARCH_RESULT') return resolve(res)
  
                let info = { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.artists.map(artist => artist.name).join(', '), length: x.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.album.images[0].url, position: 0, title: x.name, uri: x.external_urls.spotify, sourceName: 'spotify' }   

                resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info }] })
              })
              break
            }
            case 'episode': {
              this.makeLavalinkRequest('search', { identifier: `${x.name} ${x.publisher}` }).then((res) => {
                if (res.loadType != 'SEARCH_RESULT') return resolve(res)
                  
                let info = { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: null, length: x.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: 0, title: x.name, uri: x.external_urls.spotify, sourceName: 'spotify' }
              
                resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info }] })
              })
              break
            }
            case 'playlist':
            case 'album': {
              let info, response = { loadType: 'PLAYLIST_LOADED', playlistInfo: { selectedTrack: -1, name: x.name }, tracks: [] }
              x.tracks.items.forEach(async (x2, index) => {
                let res;
                if (track[1] === 'playlist') res = await this.makeLavalinkRequest('search', { identifier: `${x2.track.name} ${x2.track.artists[0].name}` })
                else res = await this.makeLavalinkRequest('search', { identifier: `${x2.name} ${x2.artists[0].name}` })

                if (res.loadType != 'SEARCH_RESULT') {
                  if (index === x.tracks.items.length) return resolve(res)
                  return;
                }

                if (track[1] === 'playlist') info = { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x2.track.artists.map(artist => artist.name).join(', '), length: x2.track.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: index, title: x2.track.name, uri: x2.track.external_urls.spotify, sourceName: 'spotify' }
                else info = { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x2.artists.map(artist => artist.name).join(', '), length: x2.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: index, title: x2.name, uri: x2.external_urls.spotify, sourceName: 'spotify' }

                response.tracks.push({ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info })

                if (response.tracks.length === x.tracks.items.length) {
                  response.tracks.sort((a, b) => a.info.position - b.info.position)
                  resolve(response)
                }
              })             
              break
            }
            case 'show': {
              let response = { loadType: 'PLAYLIST_LOADED', playlistInfo: { selectedTrack: -1, name: x.name }, tracks: [] }
              x.episodes.items.forEach(async (x2, index) => {
                let res = await this.makeLavalinkRequest('search', { identifier: `${x2.name} ${x.publisher}` })

                if (res.loadType != 'SEARCH_RESULT') {
                  if (index === x.episodes.items.length) return resolve(res)
                  return;
                }

                let info = { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.publisher, length: x2.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: index, title: x2.name, uri: x2.external_urls.spotify, sourceName: 'spotify' }

                response.tracks.push({ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info })

                if (response.tracks.length === x.episodes.items.length) {
                  response.tracks.sort((a, b) => a.info.position - b.info.position)
                  resolve(response)
                }
              })
              break
            }
            default: {
              if (deezerRegex.test(music)) {
                let track = deezerRegex.exec(music)
                let end;
        
                switch (track[1]) {
                  case 'track': 
                    end = `track/${track[2]}`
                    break
                  case 'playlist': 
                    end = `playlist/${track[2]}`
                    break
                  case 'album': 
                    end = `album/${track[2]}`
                    break
                  default:
                    return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
                }
        
                Utils.makeRequest(`https://api.deezer.com/${end}`, {
                  headers: {},
                  method: 'GET'
                }).then((x) => {
                  switch (track[1]) {
                    case 'track': {
                      if (x.error?.status === 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
                      if (x.error) return resolve({ loadType: 'LOAD_FAILED', playlistInfo: {}, tracks: [], exception: { message: x.error.message, severity: 'UNKNOWN' } })
                      this.makeLavalinkRequest('search', { identifier: `${x.title} ${x.artist.name}` }).then((res) => {
                        if (res.loadType != 'SEARCH_RESULT') return resolve(res)
          
                        let info = { ...res.tracks[0].info, author: x.artist.name, length: x.duration * 1000, artwork: x.album.cover_xl, position: 0, title: x.title, uri: x.link, sourceName: 'deezer' }
          
                        resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info }] })
                      })
                      break
                    }
                    case 'playlist':
                    case 'album': {
                      if (x.error?.status === 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
                      if (x.error) return resolve({ loadType: 'LOAD_FAILED', playlistInfo: {}, tracks: [], exception: { message: x.error.message, severity: 'UNKNOWN' } })
                      
                      let response = { loadType: 'PLAYLIST_LOADED', playlistInfo: { selectedTrack: -1, name: x.title }, tracks: [] }
                      x.tracks.data.forEach(async (x2, index) => {                
                        let res = await this.makeLavalinkRequest('search', { identifier: `${x2.title} ${x2.artist.name}` })
                        if (res.loadType != 'SEARCH_RESULT') {
                          if (index === x.tracks.data.length) return resolve(res)
                          return;
                        }
          
                        let info = { ...res.tracks[0].info,  author: x2.artist.name, length: x.duration * 1000, artwork: track[1] === 'playlist' ? x.picture_xl : x.cover_xl, position: index, title: x2.title, uri: x2.link, sourceName: 'deezer' }
          
                        response.tracks.push({ encoded: Utils.encodeTrack({ ...info, sourceName: 'youtube' }), info })
          
                        if (response.tracks.length === x.tracks.data.length) {
                          response.tracks.sort((a, b) => a.info.position - b.info.position)
                          resolve(response)
                        }
                      })
                      break
                    }
                  }
                })
              }
              break
            }
          }
        })
      } else {
        this.makeLavalinkRequest('search', { identifier: music }).then((res) => resolve(res))
      }
    })
  }

  /**
   * Skips the music, handleQueue must be enabled.
   * @returns {undefined} Will not give you a response.
   */
  skip() {
    if (Infos.Configs.Queue) {
      let queue = map.get('queue') || {}

      if (queue[this.config.guildId] && queue[this.config.guildId][1]) {
        this.makeLavalinkRequest('play', { track: queue[this.config.guildId][1] })

        map.set('queue', queue)
      }
    }
  }

  /**
   * Stop playing the music, doesn't destroy the player.
   * @returns {Error | undefined} Will error if fails to send stop payload to the Lavalink.
   */
  stop() {
    let players = map.get('players') || {}

    this.makeLavalinkRequest('stop', null)

    if (players[this.config.guildId]) {
      players[this.config.guildId] = { ...players[this.config.guildId], playing: false }
        
      if (Infos.Configs.Queue) {
        let queue = map.get('queue') || {}

        queue[this.config.guildId] = []
        map.set('queue', queue)
      }

      map.set('players', players)
    }
  }

  /** 
   * Destroys a players, it will leave the voice channel and clear guild queue.
   * @returns {Error | undefined} Will error if fails to send destroy payload to the Lavalink.
   */
  destroy() {
    let players = map.get('players') || {}

    this.makeLavalinkRequest('destroy', null)
      
    if (Infos.Configs.Queue) {
      let queue = map.get('queue') || {}

      delete queue[this.config.guildId]

      map.set('queue', queue)
    }
      
    delete players[this.config.guildId]
    
    map.set('players', players)
      
    Infos.sendDiscordPayload(
      this.config.guildId,
      JSON.stringify({
        op: 4,
        d: {
          guild_id: this.config.guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false
        }
      })
    )
  }

  /**
   * Changes the player's track volume. 
   * @param {number} volume The volume that will be set for this track.
   * @returns {Error | undefined} Will error if volume is invalid or if fails to send volume payload to the Lavalink.
   */
  setVolume(volume) {
    if (typeof volume != 'string' && typeof volume != 'number') throw new Error('volume field must be a string or a number.')

    this.makeLavalinkRequest('volume', { volume })
  }

  /**
   * Pauses or resumes a player track.
   * @param {boolean} pause true for pause, false for resume. Default is false.
   * @returns {Error | undefined} Will error if pause is invalid or if fails to send pause payload to the Lavalink.
   */
  setPaused(pause = true) {
    if (typeof pause != 'boolean') throw new Error('pause field must be a boolean.')

    let players = map.get('players') || {}

    players[this.config.guildId] = { ...players[this.config.guildId], playing: pause === true ? false : true, paused: pause }
    map.set('players', players)

    this.makeLavalinkRequest('pause', { pause })
  }

  /**
   * Removes a track from the queue, if position === 0, it will remove and skip music.
   * @param {number} position The position of the track on the queue.
   * @returns {Error | undefined} Will error if position is invalid, if there is no track with the specified position or if the queue is empty.
   */
  removeTrack(position) {
    if (Infos.Configs.Queue) {
      if (typeof position != 'string' && typeof position != 'number') throw new Error('position field must be a string or a number.')
  
      let guildQueue = map.get('queue') || {}

      if (!guildQueue[this.config.guildId][position]) throw new Error('There is no track with this position, cannot remove track.')

      if (position == 0) this.skip()
      else {
        guildQueue[this.config.guildId][position] = null
        guildQueue[this.config.guildId] = guildQueue[this.config.guildId].filter((x) => x != null)
      }

      map.set('queue', guildQueue)
    }
  }

  /**
   * Gets the guild player's queue.
   * @returns {Array<string>} The queue of the guild.
   */
  getQueue() {
    if (Infos.Configs.Queue) {
      let guildQueue = map.get('queue') || []
    
      if (guildQueue[this.config.guildId] && guildQueue[this.config.guildId][0]) return guildQueue[this.config.guildId]
      return []
    }
  }

  static setFilter(body) {
    this.makeLavalinkRequest('filters', { filter: body })
  }

  /**
   * Set the 8D effect on the player.
   * @returns {Error | undefined} Will error if it fails to send the message to a Lavalink node.
   */
  set8D() {
    return this.setFilter({ rotation: { rotationHz: 0.2 } })
  }
    
  /**
   * Set the karaoke effect on the player.
   * @returns {Error | undefined} Will error if it fails to send the message to a Lavalink node.
   */
  setKaraoke() {
    return this.setFilter({ karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } })
  }
    
  /**
   * Set the vaporwave effect on the player.
   * @returns {Error | undefined} Will error if it fails to send the message to a Lavalink node.
   */
  setVaporwave() {
    return this.setFilter({
      equalizer: [{ band: 1, gain: 0.3 }, { band: 0, gain: 0.3 }],
      timescale: { pitch: 0.5 },
      tremolo: { depth: 0.3, frequency: 14 } 
    })
  }
}

export default {
  connectNodes,
  handleRaw,
  getAllLavalinkStats,
  createPlayer,
  getPlayer,
  getAllPlayers,
  getAllQueues,
  decodeTrack: Utils.decodeTrack
}

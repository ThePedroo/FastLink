import makeRequest from './request.js'

import WebSocket from 'ws'
import events from 'events'

const map = new Map()

const Infos = { Configs: {}, LoadBalancing: {}, sendPayload: null }

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
function connectNode(nodes, infos, sPayload) {
  if (!nodes || !infos || typeof nodes != 'object' || typeof infos != 'object')
    throw new Error(`${!nodes || typeof nodes != 'object' || typeof nodes != 'object' && nodes.length == undefined ? 'first parameter must be an array' : infos == undefined || typeof infos != 'object' ? 'second parameter must be an object' : ''}.`)

  if (!nodes.length == 0)
    throw new Error('First parameter must be an array with at least one object in it.')

  if (infos.market && typeof infos.market != 'string')
    throw new Error('info\'s market must be a string.')
  if (typeof infos.shards != 'number')
    throw new Error('info\'s shards field must be a number.')
  if (typeof infos.botId != 'string' && infos.botId != 'number')
    throw new Error('info\'s botId field must be a string or a number.')

  if (!sPayload || typeof sPayload != 'function')
    throw new Error('sendPayload parameter must be a function.')

  Infos.sendPayload = sPayload

  const Event = new events()

  Infos.Configs = {
    'SpotifyToken': null,
    'SpotifyMarket': infos.market || 'US',
    'UserId': infos.botId,
    'Queue': infos.handleQueue || false,
    'Debug': infos.debug || false
  }

  makeRequest('https://open.spotify.com/get_access_token', { headers: {}, port: 443, method: 'GET' }).then((spotify) => {
    Infos.Configs.SpotifyToken = spotify.accessToken
  })

  nodes.forEach((x) => {
    if (typeof x.hostname != 'string')
      throw new Error('node\'s hostname field must be a string.')
    if (typeof x.secure != 'boolean')
      throw new Error('node\'s secure field must be a boolean.')
    if (x.port && typeof x.port != 'number' || x.port > 65535 || x.port < 0)
      throw new Error('node\'s port field must be a number from the range of 0 to')
    if (x.password && typeof x.password != 'string')
      throw new Error('node\'s password must be a string.');  

    let ws = new WebSocket(`${x.secure ? 'wss://' : 'ws://'}${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`, undefined, {
      headers: {
        Authorization: x.password,
        'Num-Shards': infos.shards,
        'User-Id': infos.botId,
        'Client-Name': 'Fastlink@1.2.2'
      }
    })

    ws.on('open', () => {
      Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = { Ws: ws, Password: x.password, Port: x.port || '' }
      if (infos.debug) console.log(`[ FASTLINK ] Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} connected`)
      Event.emit('nodeConnected', (nodes))
    })
  
    ws.on('close', (code) => {
      if (infos.debug) console.warn(`[ FASTLINK ] Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} closed connection with code ${code}.`)
      if (Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`]) Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Connected = false
      Event.emit('nodeClose', (nodes, code))
    })
    
    ws.on('error', (err) => {
      if (infos.debug) console.warn(`[ FASTLINK ] Failed to connect to node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''}, Error: ${err}`)
      Event.emit('nodeError', (nodes, err))
    })
    
    ws.on('message', (data) => {
      if (data) data = JSON.parse(data)
  
      Event.emit('raw', data)
    
      switch(data.op) {
        case 'stats': {
          if (infos.debug) console.log('[ FASTLINK ] stats object received.')
          delete data['op']
            
          Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Status = data
          Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Connected = true
            
          Event.emit('stats', data)
          break
        }
        case 'playerUpdate': {
          if (infos.debug) console.log('[ FASTLINK ] playerUpdate object received.')
          delete data['op']
          Event.emit('playerUpdate', data)
          break
        }
        case 'event': {
          switch(data.type) {
            case 'TrackStartEvent': {
              if (infos.debug) console.log('[ FASTLINK ] trackStart object received.')
  
              delete data['op']
              delete data['type']
              Event.emit('trackStart', data)
  
              break
            }
            case 'TrackEndEvent': {
              if (infos.debug) console.log('[ FASTLINK ] trackEnd object received.')
  
              delete data['op']
              delete data['type']
              if (!data.reason == 'FAKE_TRACK_END') Event.emit('trackEnd', data)
                
              if (Infos.Configs.Queue) {
                let queue = map.get('queue') || {}
                let players = map.get('players') || {}
  
                if (data.reason != 'REPLACED') {
                  if (data.reason.startsWith('FAKE_TRACK_END') || queue[data.guildId] && queue[data.guildId][1]) {     
                    let response = sendJson({ op: 'play', guildId: data.guildId, track: data.track && data.reason.startsWith('FAKE_TRACK_END') ? data.track : queue[data.guildId][1], noReplace: data.noReplace != undefined ? data.noReplace : false, pause: false })
                    if (response?.error == true) throw new Error(response.message)
  
                    if (data.reason.startsWith('FAKE_TRACK_END') && data.reason != 'FAKE_TRACK_END_SKIP') {
                      if (!queue[data.guildId]) queue[data.guildId] = []
                      queue[data.guildId].push(data.track)
                    } else {
                      queue[data.guildId].shift()
                    }
                    players[data.guildId]['track'] = queue[data.guildId][0]
                  } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1] && data.reason != 'REPLACED') {         
                    delete queue[data.guildId]
                  }
  
                  map.set('queue', queue)
                }
              }
  
              break
            }
            case 'TrackExceptionEvent': {
              if (infos.debug) console.log('[ FASTLINK ] trackException object received.')
              delete data['op']
              delete data['type']
              Event.emit('trackException', data)
  
              if (Infos.Configs.Queue) {
                let queue = map.get('queue') || {}
                let players = map.get('players') || {}
  
                if (queue[data.guildId] && queue[data.guildId][1]) {
                  let response = sendJson({ op: 'play', guildId: data.guildId, track: queue[data.guildId][1], noReplace: false, pause: false })
                  if (response?.error == true) throw new Error(response.message)
  
                  queue[data.guildId].shift()
                    
                  players[data.guildId]['track'] = queue[data.guildId][0]
                } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {              
                  delete queue[data.guildId]
                }
  
                map.set('queue', queue)
              }
  
              break
            }
            case 'TrackStuckEvent': {
              if (infos.debug) console.log('[ FASTLINK ] trackStuck object received.')
  
              delete data['op']
              delete data['type']
              Event.emit('trackStuck', data)
  
              if (Infos.Configs.Queue) {
                let queue = map.get('queue') || {}
                let players = map.get('players') || {}
  
                if (queue[data.guildId] && queue[data.guildId][1]) {
                  let response = sendJson({ op: 'play', guildId: data.guildId, track: queue[data.guildId][1], noReplace: false, pause: false })
                  if (response?.error == true) throw new Error(response.message)
  
                  queue[data.guildId].shift()
                  
                  players[data.guildId]['track'] = queue[data.guildId][0]
                } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {              
                  delete queue[data.guildId]
                }
  
                map.set('queue', queue)
              }
  
              break
            }
            case 'WebSocketClosedEvent': {
              if (infos.debug) console.log('[ FASTLINK ] websocketClosed object received.')
  
              delete data['op']
              delete data['type']
              Event.emit('websocketClosed', data)
  
              break
            }
            default: {
              if (infos.debug) console.log(`[ FASTLINK ] unknown type [${data.type || 'No type specified'}] received.`)
              Event.emit('unknownType', data)
            }
          }
          break
        }
        default: {
          if (infos.debug) console.log(`[ FASTLINK ] unknown op [${data.op || 'No op received'}] received.`)
          Event.emit('unknownOp', data)
        }
      }
    })
  })
  
  return Event
}

function getRecommendedNode() {
  const arr = []
  Object.keys(Infos.LoadBalancing).forEach((node) => {
    Infos.LoadBalancing[node] = { ...Infos.LoadBalancing[node] }
    arr.push(Infos.LoadBalancing[node])
  })
  return arr.filter((x) => x.Connected).sort((b, a) => a.Status.cpu ? (a.Status.cpu.systemLoad / a.Status.cpu.cores) * 100 : 0 - b.Status.cpu ? (b.Status.cpu.systemLoad / b.Status.cpu.cores) * 100 : 0)[0]
}

function sendJson(json) {
  let response;
  let node = getRecommendedNode()
  if (Infos.Configs.Debug) console.log(`[ FASTLINK ] Selected node ${node.Ws?._socket?._host} for send json.`)
  node.Ws.send(JSON.stringify(json), (error) => {
    if (error) response = { error: true, message: error.message }
    else response = { error: false, message: 'Sent with success.' }
  })
  return response
}

function makeSpotifyRequest(endpoint) {
  return new Promise((resolve) => {
    makeRequest(`https://api.spotify.com/v1${endpoint}`, {
      headers: { 'Authorization': `Bearer ${Infos.Configs.SpotifyToken}` },
      port: 443,
      method: 'GET'
    }).then((res) => {
      if (res?.error?.status == 401) {
        makeRequest('https://open.spotify.com/get_access_token', { headers: {}, port: 443, method: 'GET' }).then((spotify) => {
          tokens['Spotify'] = spotify.accessToken

          makeRequest(`https://api.spotify.com/v1${endpoint}`, {
            headers: { 'Authorization': `Bearer ${tokens.Spotify}` },
            port: 443,
            method: 'GET'
          }).then((res) => {
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
    if (![ 'VOICE_SERVER_UPDATE', 'VOICE_STATE_UPDATE' ].includes(data?.t)) return;

    if (data.t == 'VOICE_SERVER_UPDATE') {
      let sessionIds = map.get('sessionIds') || {}

      if (sessionIds[data.d.guild_id]) {
        let response = sendJson({
          'op': 'voiceUpdate',
          'guildId': data.d.guild_id,
          'sessionId': sessionIds[data.d.guild_id],
          'event': {
            'token': data.d.token,
            'guild_id': data.d.guild_id,
            'endpoint': data.d.endpoint
          }
        })
        if (response?.error == true) throw new Error(response.message)

        delete sessionIds[data.d.guild_id]
        map.set('sessionIds', sessionIds)
      }
    } else {
      if (!data.d.session_id) return;

      let sessionIds = map.get('sessionIds') || {}
      sessionIds[data.d.guild_id] = data.d.session_id

      if (data.d.member.user.id == Infos.Configs.UserId) map.set('sessionIds', sessionIds)
    }
  })
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
  
  config.freeze()

  let players = map.get('players') || {}

  players[config.guildId] = { voiceChannelId: config.voiceChannelId, playing: false, track: null, paused: false }
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
  
  if (guildPlayer[guildId]) {
    return (new PlayerFunctions({ guildId, voiceChannelId: guildPlayer[guildId].voiceChannelId }))
  }
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
  if (!Infos.Configs.Queue) return;
  return map.get('queue') || {}
}

/**
 * Decoded a track, and returns it's music info.
 * @param {string} track - Track that will be decoded into the music informations.
 * @returns {musicInfo} The informations about the music.
 */

function decodeTrack(track) {
  let node = getRecommendedNode()
    
  if (typeof track != 'string') throw new Error('track field must be a string.')
    
  if (Infos.Configs.Debug) console.log(`[ FASTLINK ] Selected node ${node.Ws?._socket?._host} for decode track.`)

  return makeRequest(`${node.Ws?._url.startsWith('ws:') ? 'http' : 'https'}://${node.Ws?._socket?._host}/decodetrack?track=${encodeURIComponent(track)}`, {
    headers: { 'Authorization': node.Password },
    port: node.Port,
    method: 'GET'
  })
}

class PlayerFunctions {
  /**
   * @param {object} config - Informations about the player.
   */
  constructor(config) {
    /** @type {{ guildId: number, voiceChannelId: number }} */
    this.config = config
    
    config.freeze()
  }

  /**
   * Connects to a Discord voice channel.
   * @param mute - Join the voice channel muted, not recommended.
   * @param deaf - Join the voice channel deafed, recommended.
   */
  connect(mute = false, deaf = false) {
    Infos.sendPayload(
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

    players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false }
    map.set('players', players)

    if (Infos.Configs.Queue) {
      let queue = map.get('queue') || {}

      if (queue[this.config.guildId] && queue[this.config.guildId][0]) {
        queue[this.config.guildId].push(track)
        map.set('queue', queue)
      } else {
        let node = getRecommendedNode()
        node.Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END', track: track, noReplace }))
      }
    } else {
      let response = sendJson({ op: 'play', guildId: this.config.guildId, track: track, noReplace: false, pause: false })
      if (response?.error == true) throw new Error(response.message)
    }
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
     
      if (!queue[this.config.guildId]) queue[this.config.guildId] = []
        
      if (queue[this.config.guildId][0]) {
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.track))
      } else {
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.track))
        
        let response = sendJson({ op: 'play', guildId: this.config.guildId, track: queue[this.config.guildId][0], pause: false })
        if (response?.error == true) throw new Error(response.message)
      
        players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false }
        map.set('players', players)
        
        queue[this.config.guildId].shift()
      }
      
      map.set('queue', queue)
    }
  }

  /**
   * Searchs for a music, playlist, album, episode and etc.
   * @param {string} music URL or music name that the Lavalink will search.
   * @returns searchObject
   */
  search(music) {
    if (!/^https?:\/\//.test(music)) music = `ytsearch:${music}`
    if (/^https?:\/\/(?:soundcloud\.com|snd\.sc)(?:\/\w+(?:-\w+)*)+$/.test(music)) music = `sc:${music}`
      
    return new Promise((resolve) => {
      let spotifyRegex = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|artist|episode|show|album)[/:]([A-Za-z0-9]+)/
      let ws = getRecommendedNode()
      const nodeUrl = `${ws.Ws?._url.startsWith('ws:') ? 'http' : 'https'}://${ws.Ws?._socket?._host}`
      
      if (Infos.Configs.Debug) console.log(`[ FASTLINK ] Selected node ${ws.Ws?._socket?._host} for play the music.`)
      
      if (spotifyRegex.test(music)) {
        let track = spotifyRegex.exec(music)
        let end = `/tracks/${track[2]}`
        if (track[1] == 'playlist') end = `/playlists/${track[2]}`
        if (track[1] == 'album') end = `/albums/${track[2]}`
        if (track[1] == 'episode') end = `/episodes/${track[2]}?market=${Infos.Configs.SpotifyMarket}`

        makeSpotifyRequest(end).then(async (x) => {
          if (track[1] == 'track') {
            if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
            makeRequest(`${nodeUrl}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x.name} ${x.artists[0].name}`)}`, {
              headers: { 'Authorization': ws.Password },
              port: ws.Port,
              method: 'GET'
            }).then((res) => {
              if (res.loadType != 'SEARCH_RESULT') return resolve(res)
            
              resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.artists.map(artist => artist.name).join(', '), length: x.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.album.images[0].url, position: 0, title: x.name, uri: x.external_urls.spotify, sourceName: 'spotify' } }] })
            })
          } if (track[1] == 'episode') {
            if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
            makeRequest(`${nodeUrl}/loadtracks?identifier=ytsearch:${encodeURIComponent(x.name)}`, {
              headers: { 'Authorization': ws.Password },
              port: ws.Port,
              method: 'GET'
            }).then((res) => {
              if (res.loadType != 'SEARCH_RESULT') return resolve(res)
            
              resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: null, length: x.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: 0, title: x.name, uri: x.external_urls.spotify, sourceName: 'spotify' } }] })
            })
          } else {
            if (track[1] == 'playlist') {
              if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
              
              let i = 0
              let response = { loadType: 'PLAYLIST_LOADED', playlistInfo: { selectedTrack: 0, name: x.name }, tracks: [] }
              x.tracks.items.forEach(async (x2) => {
                x2.track['position'] = i
                i++
                
                let res = await makeRequest(`${nodeUrl}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x2.track.name} ${x2.track.artists[0].name}`)}`, {
                  headers: { 'Authorization': ws.Password },
                  port: ws.Port,
                  method: 'GET'
                })
              
                if (res.loadType != 'SEARCH_RESULT') {
                  if (response.tracks.length == x.tracks.items.length) {
                    response.tracks.sort((a, b) => a.info.position - b.info.position)
                    resolve(response)
                  }
                  return;
                }
                
                response.tracks.push({ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x2.track.artists.map(artist => artist.name).join(', '), length: x2.track.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: x2.track.position, title: x2.track.name, uri: x2.track.external_urls.spotify, sourceName: 'spotify' } })

                if (response.tracks.length == x.tracks.items.length) {
                  response.tracks.sort((a, b) => a.info.position - b.info.position)
                  resolve(response)
                }
              })
            } else if (track[1] == 'album') {
              if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
              
              let i = 0
              let response = { loadType: 'PLAYLIST_LOADED', playlistInfo: { selectedTrack: 0, name: x.name }, tracks: [] }
              x.tracks.items.forEach(async (x2) => {
                x2['position'] = i
                i++
                
                let res = await makeRequest(`${nodeUrl}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x2.name} ${x2.artists[0].name}`)}`, {
                  headers: { 'Authorization': ws.Password },
                  port: ws.Port,
                  method: 'GET'
                })
              
                if (res.loadType != 'SEARCH_RESULT') {
                  if (response.tracks.length == x.tracks.items.length) {
                    response.tracks.sort((a, b) => a.info.position - b.info.position)
                    resolve(response)
                  }
                  return;
                }
                
                response.tracks.push({ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x2.artists.map(artist => artist.name).join(', '), length: x2.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: x2.position, title: x2.name, uri: x2.external_urls.spotify, sourceName: 'spotify' } })
                if (response.tracks.length == x.tracks.items.length) {
                  response.tracks.sort((a, b) => a.info.position - b.info.position)
                  resolve(response)
                }
              })
            }
          }
        })
      } else {
        makeRequest(`${nodeUrl}/loadtracks?identifier=${encodeURIComponent(music)}`, {
          headers: { 'Authorization': ws.Password },
          port: ws.Port,
          method: 'GET'
        }).then((res) => {
          res.tracks.forEach((x) => {
            x.info['artwork'] = `https://i.ytimg.com/vi/${x.info.identifier}/maxresdefault.jpg`
          })
          resolve(res)
        })
      }
    })
  }

  /**
   * Skips the music, handleQueue must be enabled.
   * @returns {undefined} Will not give you a response.
   */
  skip() {
    if (!Infos.Configs.Queue) return;

    let guildQueue = map.get('queue') || {}

    if (guildQueue[this.config.guildId] && guildQueue[this.config.guildId][1]) {
      Infos.Nodes[0].Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END_SKIP', track: guildQueue[this.config.guildId][0] }))
    }
  }

  /**
   * Stop playing the music, doesn't destroy the player.
   * @returns {Error | undefined} Will error if fails to send stop payload to the Lavalink.
   */
  stop() {
    let response = sendJson({ op: 'stop', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}

    if (players[this.config.guildId]) {
      players[this.config.guildId]['playing'] = false
      players[this.config.guildId]['track'] = null

      map.set('players', players)
    }
  }

  /** 
   * Destroys a players, it will leave the voice channel and clear guild queue.
   * @returns {Error | undefined} Will error if fails to send destroy payload to the Lavalink.
   */
  destroy() {
    let response = sendJson({ op: 'destroy', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}

    delete players[this.config.guildId]
    map.set('players', players)
  }

  /**
   * Changes the player's track volume. 
   * @param {number} volume The volume that will be set for this track.
   * @returns {Error | undefined} Will error if volume is invalid or if fails to send volume payload to the Lavalink.
   */
  setVolume(volume) {
    if (typeof volume != 'string' && typeof volume != 'number') throw new Error('volume field must be a string or a number.')

    let response = sendJson({ op: 'volume', guildId: this.config.guildId, volume })
    if (response?.error == true) throw new Error(response.message)
  }

  /**
   * Pauses or resumes a player track.
   * @param {boolean} pause true for pause, false for resume. Default is false.
   * @returns {Error | undefined} Will error if pause is invalid or if fails to send pause payload to the Lavalink.
   */
  setPaused(pause = true) {
    if (typeof pause != 'boolean') throw new Error('pause field must be a boolean.')

    let players = map.get('players') || {}
    players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: pause == true ? false : true, track: players[this.config.guildId].track, paused: pause }
    map.set('players', players)

    let response = sendJson({ op: 'pause', guildId: this.config.guildId, pause })
    if (response?.error == true) throw new Error(response.message)
  }

  /**
   * Removes a track from the queue, if position == 0, it will remove and skip music.
   * @param {number} position The position of the track on the queue.
   * @returns {Error | undefined} Will error if position is invalid, if there is no track with the specified position or if the queue is empty.
   */
  removeTrack(position) {
    if (!Infos.Configs.Queue) return;
    if (typeof position != 'string' && typeof position != 'number') throw new Error('position field must be a string or a number.')
  
    let guildQueue = map.get('queue') || {}
  
    if (guildQueue[this.config.guildId] && guildQueue[this.config.guildId].length != 0) {
      if (position == 0) {
        if (!guildQueue[this.config.guildId][1]) throw new Error('Queue is empty, cannot remove track.')
        Infos.Nodes[0].Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END_SKIP', track: guildQueue[this.config.guildId][0] }))
      }
    } else {
      if (!guildQueue[this.config.guildId][Number(position)]) throw new Error('There is no track with this position, cannot remove track.')
          
      guildQueue[this.config.guildId][Number(position)] = null
      guildQueue[this.config.guildId] = guildQueue[this.config.guildId].filter((x) => x != null)
  
      map.set('queue', guildQueue)
    }
  }

  /**
   * Gets the guild player's queue.
   * @returns {Array<object> | object} The queue of the guild.
   */
  getQueue() {
    if (!Infos.Configs.Queue) return;
  
    let guildQueue = map.get('queue') || {}
    
    if (guildQueue[this.config.guildId]) return guildQueue[this.config.guildId]
    return guildQueue
  }
}

export default { 
  connectNode,
  handleRaw,
  createPlayer,
  getPlayer,
  getAllPlayers,
  getAllQueues,
  decodeTrack
}

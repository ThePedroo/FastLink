import makeRequest from './request.js'

import WebSocket from 'ws'
import events from 'events'

const Event = new events()
const map = new Map()

const tokens = {}
const nodeInfos = []

let sendPayload;

function connectNode(object, infos, sPayload) {
  if (!object || !infos || typeof object != 'object' || typeof infos != 'object') throw new Error(`${object == undefined || typeof object == 'object' ? 'first parameter' : infos == undefined || typeof infos == 'object' ? 'second parameter' : ''} must be an object.`)

  if (typeof infos.shards != 'number') throw new Error('shards field must be a number')
  if (typeof infos.botId != 'string' && infos.botId != 'number') throw new Error('botId field must be a string or a number.')

  sendPayload = sPayload

  let ws = new WebSocket(`${object.secure ? 'wss://' : 'ws://'}${object.host}${object.port != undefined ? `:${object.port}` : ''}`, undefined, {
    headers: {
      Authorization: object.password,
      'Num-Shards': infos.shards,
      'User-Id': infos.botId,
      'Client-Name': 'Fastlink@1.1.9'
    }
  })

  nodeInfos.push({
    'SpotifyMarket': infos.market,
    'Password': object.password,
    'UserId': infos.botId,
    'Port': object.port || 443,
    'Queue': infos.handleQueue,
    'Ws': ws
  })

  makeRequest('https://open.spotify.com/get_access_token', { headers: {}, port: 443, method: 'GET' }).then((spotify) => {
    tokens['Spotify'] = spotify.accessToken
  })

  ws.on('open', () => {
    if (infos.debug) console.log('[ FASTLINK ] Node connected')
    Event.emit('nodeConnected', (object))
  })

  ws.on('close', (code) => {
    if (infos.debug) console.warn(`[ FASTLINK ] Node closed connection with code ${code}.`)
    Event.emit('nodeClose', (object, code))
  })
  
  ws.on('error', (err) => {
    if (infos.debug) console.warn(`[ FASTLINK ] Failed to connect to node, Error: ${err}`)
    Event.emit('nodeError', (object, err))
  })
  
  ws.on('message', (data) => {
    if (data) data = JSON.parse(data)

    Event.emit('raw', data)
  
    switch(data.op) {
      case 'stats': {
        if (infos.debug) console.log('[ FASTLINK ] stats object received.')
        delete data['op']
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
              
            if (nodeInfos[0].Queue) {
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

            if (nodeInfos[0].Queue) {
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

            if (nodeInfos[0].Queue) {
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
}

function sendJson(json) {
  let response;
  nodeInfos[0].Ws.send(JSON.stringify(json), (error) => {
    if (error) response = { error: true, message: error.message }
    else response = { error: false, message: 'Sent with success.' }
  })
  return response
}

function makeSpotifyRequest(endpoint) {
  return new Promise((resolve) => {
    makeRequest(`https://api.spotify.com/v1${endpoint}`, {
      headers: { 'Authorization': `Bearer ${tokens.Spotify}` },
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

function handleRaw(data) {
  if (![ 'VOICE_SERVER_UPDATE', 'VOICE_STATE_UPDATE' ].includes(data?.t)) return;

  if (data.t == 'VOICE_SERVER_UPDATE') {
    let sessionIds = map.get('sessionIds') || {}

    if (sessionIds[data.d.guild_id]) {
      let response = sendJson({
        'op': 'voiceUpdate',
        'guildId': data.d.guild_id,
        'sessionId': sessionIds[data.d.guild_id],
        'event': data.d
      })
      if (response?.error == true) throw new Error(response.message)

      delete sessionIds[data.d.guild_id]
      map.set('sessionIds', sessionIds)
    }
  } else {
    if (!data.d.session_id) return;

    let sessionIds = map.get('sessionIds') || {}
    sessionIds[data.d.guild_id] = data.d.session_id

    if (data.d.member.user.id == nodeInfos[0].UserId) map.set('sessionIds', sessionIds)
  }
}

function getLavalinkEvents() {
  return Event
}

class PlayerFunctions {
  constructor(config) {
    this.config = config
  }
  connect(mute = false, deaf = false) {
    sendPayload(
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
  play(track, noReplace = false) {
    if (typeof track != 'string') throw new Error('track field must be a string.')

    let players = map.get('players') || {}

    players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false }
    map.set('players', players)

    if (nodeInfos[0].Queue) {
      let queue = map.get('queue') || {}

      if (queue[this.config.guildId] && queue[this.config.guildId][0]) {
        queue[this.config.guildId].push(track)
        map.set('queue', queue)
      } else {
        nodeInfos[0].Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END', track: track, noReplace }))
      }
    } else {
      let response = sendJson({ op: 'play', guildId: this.config.guildId, track: track, noReplace: false, pause: false })
      if (response?.error == true) throw new Error(response.message)
    }
  }
  playPlaylist(track) {
    if (nodeInfos[0].Queue) {
      let queue = map.get('queue') || {}
      let players = map.get('players') || {}
     
      if (!queue[this.config.guildId]) queue[this.config.guildId] = []
        
      if (queue[this.config.guildId][0]) {
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.track))
      } else {
        track.tracks.forEach((x) => queue[this.config.guildId].push(x.track))
        
        let response = sendJson({ op: 'play', guildId: this.config.guildId, track: queue[this.config.guildId][0], noReplace: false, pause: false })
        if (response?.error == true) throw new Error(response.message)
      
        players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false }
        map.set('players', players)
        
        queue[this.config.guildId].shift()
      }
      
      map.set('queue', queue)
    }
  }
  skip() {
    if (!nodeInfos[0].Queue) return;

    let guildQueue = map.get('queue') || {}

    if (guildQueue[this.config.guildId] && guildQueue[this.config.guildId][1]) {
      nodeInfos[0].Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END_SKIP', track: guildQueue[this.config.guildId][0] }))
    }
  }
  search(music) {
    if (!/^https?:\/\//.test(music)) music = `ytsearch:${music}`
    if (/^https?:\/\/(?:soundcloud\.com|snd\.sc)(?:\/\w+(?:-\w+)*)+$/.test(music)) music = `sc:${music}`
      
    return new Promise((resolve) => {
      let spotifyRegex = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|artist|episode|show|album)[/:]([A-Za-z0-9]+)/
      if (spotifyRegex.test(music)) {
        let track = spotifyRegex.exec(music)
        let end = `/tracks/${track[2]}`
        if (track[1] == 'playlist') end = `/playlists/${track[2]}`
        if (track[1] == 'album') end = `/albums/${track[2]}`
        if (track[1] == 'episode') end = `/episodes/${track[2]}?market=${nodeInfos[0].SpotifyMarket}`

        makeSpotifyRequest(end).then(async (x) => {

          if (track[1] == 'track') {
            if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
            makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x.name} ${x.artists[0].name}`)}`, {
              headers: { 'Authorization': nodeInfos[0].Password },
              port: nodeInfos[0].Port,
              method: 'GET'
            }).then((res) => {
              if (res.loadType != 'SEARCH_RESULT') return resolve(res)
            
              resolve({ loadType: 'SEARCH_RESULT', playlistInfo: {}, tracks: [{ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.artists.map(artist => artist.name).join(', '), length: x.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.album.images[0].url, position: 0, title: x.name, uri: x.external_urls.spotify, sourceName: 'spotify' } }] })
            })
          } if (track[1] == 'episode') {
            if (x?.error?.status == 400) return resolve({ loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] })
            makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=ytsearch:${encodeURIComponent(x.name)}`, {
              headers: { 'Authorization': nodeInfos[0].Password },
              port: nodeInfos[0].Port,
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
                
                let res = await makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x2.track.name} ${x2.track.artists[0].name}`)}`, {
                  headers: { 'Authorization': nodeInfos[0].Password },
                  port: nodeInfos[0].Port,
                  method: 'GET'
                })
              
                if (res.loadType != 'SEARCH_RESULT') {
                  if (response.tracks.length == x.tracks.items.length) {
                    response.tracks.sort((a, b) => a.info.position - b.info.position)
                    resolve(response)
                  }
                  return;
                }
                
                response.tracks.push({ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.track.artists.map(artist => artist.name).join(', '), length: x2.track.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: x2.track.position, title: x2.track.name, uri: x2.track.external_urls.spotify, sourceName: 'spotify' } })

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
                
                let res = await makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=ytsearch:${encodeURIComponent(`${x2.name} ${x2.artists[0].name}`)}`, {
                  headers: { 'Authorization': nodeInfos[0].Password },
                  port: nodeInfos[0].Port,
                  method: 'GET'
                })
              
                if (res.loadType != 'SEARCH_RESULT') {
                  if (response.tracks.length == x.tracks.items.length) {
                    response.tracks.sort((a, b) => a.info.position - b.info.position)
                    resolve(response)
                  }
                  return;
                }
                
                response.tracks.push({ track: res.tracks[0].track, info: { identifier: res.tracks[0].info.identifier, isSeekable: res.tracks[0].info.isSeekable, author: x.artists.map(artist => artist.name).join(', '), length: x2.duration_ms, isStream: res.tracks[0].info.isStream, artwork: x.images[0].url, position: x2.position, title: x2.name, uri: x2.external_urls.spotify, sourceName: 'spotify' } })
                if (response.tracks.length == x.tracks.items.length) {
                  response.tracks.sort((a, b) => a.info.position - b.info.position)
                  resolve(response)
                }
              })
            }
          }
        })
      } else {
        makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=${encodeURIComponent(music)}`, {
          headers: { 'Authorization': nodeInfos[0].Password },
          port: nodeInfos[0].Port,
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
  stop() {
    let response = sendJson({ op: 'stop', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}

    delete players[this.config.guildId]
    map.set('players', players)
  }
  destroy() {
    let response = sendJson({ op: 'destroy', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}

    delete players[this.config.guildId]
    map.set('players', players)
  }
  setVolume(volume) {
    if (typeof volume != 'string' && typeof volume != 'number') throw new Error('volume field must be a string or a number.')

    let response = sendJson({ op: 'volume', guildId: this.config.guildId, volume })
    if (response?.error == true) throw new Error(response.message)
  }
  setPaused(pause = true) {
    if (typeof pause != 'boolean') throw new Error('pause field must be a boolean.')

    let players = map.get('players') || {}
    players[this.config.guildId] = { voiceChannelId: this.config.voiceChannelId, playing: pause == true ? false : true, track: players[this.config.guildId].track, paused: pause }
    map.set('players', players)

    let response = sendJson({ op: 'pause', guildId: this.config.guildId, pause })
    if (response?.error == true) throw new Error(response.message)
  }
  removeTrack(position) {
    if (!nodeInfos[0].Queue) return;
    if (typeof position != 'string' && typeof position != 'number') throw new Error('position field must be a string or a number.')
  
    let guildQueue = map.get('queue') || {}
  
    if (guildQueue[this.config.guildId] && guildQueue[this.config.guildId].length != 0) {
      if (position == 0) {
        if (!guildQueue[this.config.guild][1]) throw new Error('Queue is empyt, cannot remove track.')
        nodeInfos[0].Ws.emit('message', JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: this.config.guildId, reason: 'FAKE_TRACK_END_SKIP', track: guildQueue[this.config.guildId][0] }))
      }
    } else {
      if (!guildQueue[this.config.guild][Number(position)]) throw new Error('There is no track with this position, cannot remove track.')
          
      guildQueue[this.config.guildId][Number(position)] = null
      guildQueue[this.config.guildId] = guildQueue[this.config.guildId].filter((x) => x != null)
  
      map.set('queue', guildQueue)
    }
  }
  getQueue() {
    if (!nodeInfos[0].Queue) return;
  
    let guildQueue = map.get('queue') || {}
    
    if (guildQueue[this.config.guildId]) return guildQueue[this.config.guildId]
    return guildQueue
  }
}

function createPlayer(config) {
  if (config && typeof config != 'object') throw new Error('createPlayer parameter must be a object with guildId and voiceChannelId keys.')
  if (typeof config.guildId != 'string' && typeof config.guildId != 'number') throw new Error('guildId field must be a string or a number.')
  if (typeof config.voiceChannelId != 'string' && typeof config.voiceChannelId != 'number') throw new Error('voiceChannelId field must be a string or a number.')

  let players = map.get('players') || {}

  players[config.guildId] = { voiceChannelId: config.voiceChannelId, playing: false, track: null, paused: false }
  map.set('players', players)

  return (new PlayerFunctions(config))
}

function getPlayer(guildId) {
  if (typeof guildId != 'string' && typeof guildId != 'number') throw new Error('guildId field must be a string or a number.')

  let guildPlayer = map.get('players') || {}
  
  if (guildPlayer[guildId]) {
    return (new PlayerFunctions({ guildId, voiceChannelId: guildPlayer[guildId].voiceChannelId }))
  }
}

function getAllPlayers() {
  return map.get('players') || {}
}

function getAllQueues() {
  if (!nodeInfos[0].Queue) return;
  return map.get('queue') || {}
}

function decodeTrack(track) {
  if (typeof track != 'string') throw new Error('track field must be a string.')

  return makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/decodetrack?track=${encodeURIComponent(track)}`, {
    headers: { 'Authorization': nodeInfos[0].Password },
    port: nodeInfos[0].Port,
    method: 'GET'
  })
}

export default { 
  connectNode,
  handleRaw,
  getLavalinkEvents,
  createPlayer,
  getPlayer,
  getAllPlayers,
  getAllQueues,
  decodeTrack
}
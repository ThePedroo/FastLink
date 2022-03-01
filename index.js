import makeRequest from './request.js'

import WebSocket from 'ws'
import events from 'events'

const Event = new events()
const map = new Map()

const nodeInfos = []
let sendPayload;

function connectNode(object, infos, sendFunction) {
  let ws = new WebSocket(`${object.secure ? 'wss://' : 'ws://'}${object.host}${object.port != undefined ? `:${object.port}` : ''}`, undefined, {
    headers: {
      Authorization: object.password,
      "Num-Shards": infos.shards,
      "User-Id": infos.botId,
      "Client-Name": "Fastlink"
    }
  })

  sendPayload = sendFunction

  nodeInfos.push({
    "Password": object.password,
    "UserId": infos.botId,
    "Port": object.port ? object.port : 443,
    "Ws": ws
  })

  ws.on('open', () => {
    if (infos.debug) console.log('[ FASTLINK ] Node connected')
    Event.emit('nodeConnected')
  })
  
  ws.on('error', (err) => {
    if (infos.debug) console.warn(`[ FASTLINK ] Failed to connect to node.`)
    Event.emit('nodeError', (err))
  })
  
  ws.on('close', () => {
    if (infos.debug) console.warn(`[ FASTLINK ] Node closed connection unexpectally.`)
    Event.emit('nodeClose')
  })
  
  ws.on('message', (data) => {
    if (data) data = JSON.parse(data)

    Event.emit('raw', data)

    switch(data.op) {
      case 'stats': {
        if (infos.debug) console.log('[ FASTLINK ] stats object received.')
        Event.emit('stats', data)
        break
      }
      case 'playerUpdate': {
        if (infos.debug) console.log('[ FASTLINK ] playerUpdate object received.')
        Event.emit(data.op, data)
        break
      }
      case 'event': {
        switch(data.type) {
          case 'TrackStartEvent': {
            if (infos.debug) console.log('[ FASTLINK ] trackStart object received.')
            Event.emit('trackStart', data)
            break
          }
          case 'TrackStuckEvent': {
            if (infos.debug) console.log('[ FASTLINK ] trackStuck object received.')
            Event.emit('trackStuck', data)
            break
          }
          case 'TrackEndEvent': {
            if (infos.debug) console.log('[ FASTLINK ] trackEnd object received.')
            Event.emit('trackEnd', data)
            break
          }
          case 'TrackExceptionEvent': {
            if (infos.debug) console.log('[ FASTLINK ] trackException object received.')
            Event.emit('trackException', data)
            break
          }
          case 'WebSocketClosedEvent': {
            if (infos.debug) console.log('[ FASTLINK ] websocketClosed object received.')
            Event.emit('websocketClosed', data)
            break
          }
          default: {
            if (infos.debug) console.log(`[ FASTLINK ] unknown type [${data.type}] received.`)
            Event.emit('unknownType', data)
          }
        }
        break
      }
      default: {
        if (infos.debug) console.log(`[ FASTLINK ] unknown op [${data.op}] received.`)
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

function handleRaw(data) {
  if (![ 'VOICE_SERVER_UPDATE', 'VOICE_STATE_UPDATE' ].includes(data?.t)) return;

  if (data.t == 'VOICE_SERVER_UPDATE') {
    let sessionIds = map.get('sessionIds')

    if (sessionIds[data.d.guild_id.toString()]) {
      let response = sendJson({
        "op": "voiceUpdate",
        "guildId": data.d.guild_id.toString(),
        "sessionId": sessionIds[data.d.guild_id.toString()],
        "event": data.d
      })
      if (response?.error == true) throw new Error(response.message)
      delete sessionIds[data.d.guild_id.toString()]
      map.set('sessionIds', sessionIds)
    }
  } else {
    let sessionIds = map.get('sessionIds') || {}
    sessionIds[data.d.guild_id.toString()] = data.d.session_id.toString()
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
    }))
  }
  play(track, noReplace = false) {
    if (typeof track != 'string') throw new Error('track field must be a string.')
  
    let response = sendJson({ op: 'play', guildId: this.config.guildId, track, noReplace: typeof noReplace != 'boolean' ? false : noReplace, pause: false })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}
      
    players[this.config.guildId.toString()] = { voiceChannelId: this.config.voiceChannelId, playing: true, track, paused: false }
    map.set('players', players)
  }
  search(music) {
    if (!/^https?:\/\//.test(music)) music = `ytsearch:${music}`
    if (/^https?:\/\/(?:soundcloud\.com|snd\.sc)(?:\/\w+(?:-\w+)*)+$/.test(music)) music = `sc:${music}`
    return makeRequest(`${nodeInfos[0].Ws._url.startsWith('ws:') ? 'http' : 'https'}://${nodeInfos[0].Ws._socket._host}/loadtracks?identifier=${encodeURIComponent(music)}`, {
      header: { 'Authorization': nodeInfos[0].Password },
      port: nodeInfos[0].Port,
      method: 'GET'
    })
  }
  stop() {
    let response = sendJson({ op: 'stop', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}
    delete players[this.config.guildId.toString()]
    map.set('players', players)
  }
  destroy() {
    let response = sendJson({ op: 'destroy', guildId: this.config.guildId })
    if (response?.error == true) throw new Error(response.message)

    let players = map.get('players') || {}
    delete players[this.config.guildId.toString()]
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
    players[this.config.guildId.toString()] = { voiceChannelId: this.config.voiceChannelId, playing: pause == true ? false : true, track: players[this.config.guildId.toString()].track, paused: pause }
    map.set('players', players)

    let response = sendJson({ op: 'pause', guildId: this.config.guildId, pause })
    if (response?.error == true) throw new Error(response.message)
  }
}

function createPlayer(config) {
  if (config && typeof config != 'object') throw new Error('createPlayer parameter must be a object with guildId and voiceChannelId keys.')
  if (typeof config.guildId != 'string' && typeof config.guildId != 'number') throw new Error('guildId field must be a string or a number.')
  if (typeof config.voiceChannelId != 'string' && typeof config.voiceChannelId != 'number') throw new Error('voiceChannelId field must be a string or a number.')

  let players = map.get('players') || {}
  players[config.guildId.toString()] = { voiceChannelId: config.voiceChannelId, playing: false, track: null, paused: false }
  map.set('players', players)

  return (new PlayerFunctions(config))
}

function getPlayer(guildId) {
  if (typeof guildId != 'string' && typeof guildId != 'number') throw new Error('guildId field must be a string or a number.')

  let guildPlayer = map.get('players')[guildId.toString()]
    
  if (guildPlayer) return (new PlayerFunctions({ guildId, voiceChannelId: guildPlayer.voiceChannelId }))
}

function getAllPlayers() {
  return map.get('players')
}

export default { connectNode, handleRaw, getLavalinkEvents, createPlayer, getPlayer, getAllPlayers }

'use strict'

import event from 'events'
const Event = new event()

import https from 'https'
import http from 'http'

import WebSocket from 'ws'

function debug(message) {
  Event.emit('debug', message)
}

function makeRequest(url, options) {
  return new Promise((resolve) => {
    let req, data = ''

    options.headers['User-Agent'] = 'FastLink@1.4.1'

    let request = https.request
    if (url.startsWith('http://')) request = http.request

    req = request(url, { port: options.port, method: options.method || 'GET', headers: options.headers }, (res) => {
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          let json = JSON.parse(data)
          resolve(json)
        } catch (err) {
          resolve(data)
        }
      })
    })

    req.on('error', (error) => {
      throw new Error('Failed sending HTTP request to the Lavalink.', error)
    })

    if (options.body) req.end(JSON.stringify(options.body))
    else req.end()
  })
}

function reconnect(ws, Infos, map, node, informations) {
  ws = new WebSocket(`${node.secure ? 'wss://' : 'ws://'}${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`, undefined, {
    headers: {
      Authorization: node.password,
      'Num-Shards': informations.shards,
      'User-Id': informations.botId,
      'Client-Name': 'Fastlink@1.4.1'
    }
  })
  ws.on('open', () => onOpen(Infos, ws, node))
  ws.on('close', (code) => {
    let res = onClose(code, ws, Infos, map, node, informations)
    Infos = res.Infos
    ws = res.ws
  })
  ws.on('error', (error) => onError(error, node))
  ws.on('message', (data) => {
    Infos = onMessage(data, Infos, map, node)
  })
  return { ws, Infos }
}

function onOpen(Infos, ws, node) {
  debug(`Node ${node.hostname}${node.port != undefined ? `:${node.port}` : ''} connected`)
  Event.emit('nodeConnect', (node))
}

function onClose(code, ws, Infos, map, node, informations) {
  debug(`Node ${node.hostname}${node.port != undefined ? `:${node.port}` : ''} closed connection with code ${code}.`)

  let nodeInfo = Infos.Nodes[`${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`]

  if (Infos.Configs.MaxTries <= -1 || nodeInfo.reconnects <= Infos.Configs.MaxTries) {
    setTimeout(() => {
      let res = reconnect(ws, Infos, map, node, informations)
      Infos = res.Infos
      ws = res.ws
    }, Infos.Configs.Delay)
  } else {
    nodeInfo.reconnects++

    let players = map.get('players') || {}
    let queues = map.get('queues') || {}

    Object.keys(players).forEach((node) => {
      if (players[node].node == `${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`) {
        delete players[node]
        delete queues[node]
      }
    })

    map.set('players', players)
    map.set('queues', queues)

    debug('Removed all players related to the offline node.')
    Event.emit('nodeClosed', (node, code))
  }

  return { ws, Infos }
}

function onError(error, node) {
  debug(`Failed to connect to node ${node.hostname}${node.port != undefined ? `:${node.port}` : ''}, Error: ${error}`)

  Event.emit('nodeError', (node, error))
}

function onMessage(data, Infos, map, node) {
  if (data) data = JSON.parse(data)

  Event.emit('raw', data)

  if (data.type && data.op == 'event') debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.type.replace('Event', '')[0].toLowerCase()) ? 'An' : 'A'} ${data.type.replace('Event', '')[0].toLowerCase() + data.type.replace('Event', '').slice(1)} payload has been received.`)
  else debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.op.toLowerCase()[0]) ? 'An' : 'A'} ${data.op} payload has been received.`)

  switch (data.op) {
    case 'ready': {
      delete data.op
      
      Infos.Nodes[`${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`].sessionId = data.sessionId

      Event.emit('ready', data)
    }
    case 'stats': {
      delete data.op

      Infos.Nodes[`${node.hostname}${node.port != undefined ? `:${node.port}` : ''}`].stats = data

      Event.emit('stats', data)
      break
    }
    case 'playerUpdate': {
      delete data.op

      Event.emit('playerUpdate', data)
      break
    }
    case 'event': {
      switch (data.type) {
        case 'TrackStartEvent': {
          delete data.op
          delete data.type

          Event.emit('trackStart', data)
          break
        }
        case 'TrackEndEvent': {
          delete data.op
          delete data.type

          if (Infos.Configs.Queue) {
            let queue = map.get('queue') || {}
            let players = map.get('players') || {}

            if (queue[data.guildId] && queue[data.guildId][1]) {
              if (data.reason == 'LOAD_FAILED') throw new Error('This is really bad, and shouldn\'t happen! Please report to the FastLink\'s owner ASAP.', data)
              
              if (data.reason == 'FINISHED') {
                makeRequest(`${players[data.guildId].ssl ? 'https://' : 'http://'}${players[data.guildId].node}/v4/sessions/${Infos.Nodes[players[data.guildId].node].sessionId}/players/${data.guildId}`, {
                  headers: {
                    Authorization: Infos.Nodes[players[data.guildId].node].password,
                    'Content-Type': 'application/json',
                    'Client-Name': 'FastLink',
                    'User-Agent': 'https'
                  },
                  method: 'PATCH',
                  body: {
                    encodedTrack: queue[data.guildId][1]
                  }
                })
                switch (players[data.guildId].loop) {
                  case 'track':
                    // Do not modify queue
                    break;
                  case 'queue':
                    queue[data.guildId].shift()
                    queue[data.guildId].push(queue[data.guildId][0])
                    break;
                  default:
                    queue[data.guildId].shift()
                    break;
                }
              }
              if (data.reason == 'REPLACED') queue[data.guildId].shift()
            } else {
              delete queue[data.guildId]
            }

            map.set('queue', queue)
          }

          Event.emit('trackEnd', data)
          break
        }
        case 'TrackExceptionEvent': {
          Event.emit('warn', 'Something broke while playing the track. This PROBABLY is not a FastLink\'s bug, do not submit a report [IF IT IS, PLEASE SUBMIT A BUG REPORT]. You ought to look the Lavalink\'s log, if it continues you should submit a bug report to Lavalink.')

          delete data.op
          delete data.type

          if (Infos.Configs.Queue) {
            let queue = map.get('queue') || {}
            let players = map.get('players') || {}

            if (queue[data.guildId] && queue[data.guildId][1]) {
              makeRequest(`${players[data.guildId].ssl ? 'https://' : 'http://'}${players[data.guildId].node}/v4/sessions/${Infos.Nodes[players[data.guildId].node].sessionId}/players/${data.guildId}`, {
                headers: {
                  Authorization: Infos.Nodes[players[data.guildId].node].password,
                  'Content-Type': 'application/json',
                  'Client-Name': 'FastLink',
                  'User-Agent': 'https'
                },
                method: 'PATCH',
                body: {
                  encodedTrack: queue[data.guildId][1]
                }
              })

              queue[data.guildId].shift()
            }

            map.set('queue', queue)
          } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
            delete queue[data.guildId]
          }

          Event.emit('trackException', data)
          break
        }
        case 'TrackStuckEvent': {
          Event.emit('warn', 'The track is stuck. This is not a FastLink\'s bug, do not submit a bug report. If it continues, please submit a bug report to Lavalink.')

          delete data.op
          delete data.type

          if (Infos.Configs.Queue) {
            let queue = map.get('queues') || {}
            let players = map.get('players') || {}

            if (queue[data.guildId] && queue[data.guildId][1]) {
              makeRequest(`${players[data.guildId].ssl ? 'https://' : 'http://'}${players[data.guildId].node}/v4/sessions/${Infos.Nodes[players[data.guildId].node].sessionId}/players/${data.guildId}`, {
                headers: {
                  Authorization: Infos.Nodes[players[data.guildId].node].password,
                  'Content-Type': 'application/json',
                  'Client-Name': 'FastLink',
                  'User-Agent': 'https'
                },
                method: 'PATCH',
                body: {
                  encodedTrack: queue[data.guildId][1]
                }
              })

              queue[data.guildId].shift()
            }

            map.set('queue', queue)
          } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
            delete queue[data.guildId]
          }

          Event.emit('trackStuck', data)
          break
        }
        case 'WebSocketClosedEvent': {
          if (data.reason == 'Your session is no longer valid.') Event.emit('warn', 'Session ID is no longer valid. You should check if you have the handleRaw, and if you are not using the method to connect to the voice channel of your Discord library.\nIn case of none of these are the problem, the problem is with FastLink, please submit a bug report.')
          else Event.emit('warn', `Lavalink error message: ${data.reason}.\nThis is probably not a problem with FastLink, but if it is, please submit a bug report.`)

          delete data.op
          delete data.type

          Event.emit('websocketClosed', data)
          break
        }
        default: {
          debug(`Unknown type [${data.type || 'No type specified'}] received.`)
          Event.emit('unknownType', data)
        }
      }
      break
    }
    default: {
      debug(`Unknown op [${data.op || 'No op received'}] received.`)
      Event.emit('unknownOp', data)
    }
  }

  return Infos
}

function getEvent() {
  return Event
}

class EncodeClass {
  constructor(size) {
    this.position = 0
    this.buffer = Buffer.alloc(size || 256)
  }

  changeBytes(bytes) {
    if (this.position + bytes >= this.buffer.length) {
      const newBuffer = Buffer.alloc(Math.max(this.buffer.length * 2, this.position + bytes))
      this.buffer.copy(newBuffer)
      this.buffer = newBuffer
    }
    this.position += bytes
    return this.position - bytes
  }

  write(type, value) {
    switch (type) {
      case 'byte': {
        this.buffer[this.changeBytes(1)] = value
        break
      }
      case 'unsignedShort': {
        this.buffer.writeUInt16BE(value, this.changeBytes(2))
        break
      }
      case 'int': {
        this.buffer.writeInt32BE(value, this.changeBytes(4))
        break
      }
      case 'long': {
        const msb = value / BigInt(2 ** 32)
        const lsb = value % BigInt(2 ** 32)

        this.write('int', Number(msb))
        this.write('int', Number(lsb))
        break
      }
      case 'utf': {
        const len = Buffer.byteLength(value, 'utf8')
        this.write('unsignedShort', len)
        const start = this.changeBytes(len)
        this.buffer.write(value, start, len, 'utf8')
        break
      }
      default: {
        throw new Error(`Unknown type ${type}, please report that.`)
      }
    }
  }

  result() {
    return this.buffer.slice(0, this.position)
  }
}

function encodeTrack(obj) {
  const buf = new EncodeClass()

  buf.write('byte', 3)
  buf.write('utf', obj.title)
  buf.write('utf', obj.author)
  buf.write('long', BigInt(obj.length))
  buf.write('utf', obj.identifier)
  buf.write('byte', obj.isStream ? 1 : 0)
  buf.write('byte', obj.uri ? 1 : 0)
  if (obj.uri) buf.write('utf', obj.uri)
  buf.write('byte', obj.artworkUrl ? 1 : 0)
  if (obj.artworkUrl) buf.write('utf', obj.artworkUrl)
  buf.write('byte', obj.isrc ? 1 : 0)
  if (obj.isrc) buf.write('utf', obj.isrc)
  buf.write('utf', obj.sourceName)
  buf.write('long', BigInt(obj.position))

  const buffer = buf.result()
  const result = Buffer.alloc(buffer.length + 4)

  result.writeInt32BE(buffer.length | (1 << 30))
  buffer.copy(result, 4)

  return result.toString('base64')
}

class DecodeClass {
  constructor(buffer) {
    this.position = 0
    this.buffer = buffer
  }

  changeBytes(bytes) {
    this.position += bytes
    return this.position - bytes
  }

  read(type) {
    switch (type) {
      case 'byte': {
        return this.buffer[this.changeBytes(1)]
      }
      case 'unsignedShort': {
        const result = this.buffer.readUInt16BE(this.changeBytes(2))
        return result
      }
      case 'int': {
        const result = this.buffer.readInt32BE(this.changeBytes(4))
        return result
      }
      case 'long': {
        const msb = BigInt(this.read('int'))
        const lsb = BigInt(this.read('int'))

        return msb * BigInt(2 ** 32) + lsb
      }
      case 'utf': {
        const len = this.read('unsignedShort')
        const start = this.changeBytes(len)
        const result = this.buffer.toString('utf8', start, start + len)
        return result
      }
    }
  }
}

function decodeTrack(track) {
  const buf = new DecodeClass(Buffer.from(track, 'base64'))

  const version = ((buf.read('int') & 0xC0000000) >> 30 & 1) !== 0 ? buf.read('byte') : 1

  switch (version) {
    case 1: {
      return {
        title: buf.read('utf'),
        author: buf.read('utf'),
        length: Number(buf.read('long')),
        identifier: buf.read('utf'),
        isStream: buf.read('byte') == 1,
        uri: null,
        source: buf.read('utf'),
        position: Number(buf.read('long'))
      }
    }
    case 2: {
      return {
        title: buf.read('utf'),
        author: buf.read('utf'),
        length: Number(buf.read('long')),
        identifier: buf.read('utf'),
        isStream: buf.read('byte') == 1,
        uri: buf.read('byte') == 1 ? buf.read('utf') : null,
        source: buf.read('utf'),
        position: Number(buf.read('long'))
      }
    }
    case 3: {
      return {
        title: buf.read('utf'),
        author: buf.read('utf'),
        length: Number(buf.read('long')),
        identifier: buf.read('utf'),
        isSeekable: true,
        isStream: buf.read('byte') == 1,
        uri: buf.read('byte') == 1 ? buf.read('utf') : null,
        artworkUrl: buf.read('byte') == 1 ? buf.read('utf') : null,
        isrc: buf.read('byte') == 1 ? buf.read('utf') : null,
        sourceName: buf.read('utf'),
        position: Number(buf.read('long'))
      }
    }
  }
}

export default { makeRequest, debug, onOpen, onClose, onError, onMessage, getEvent, encodeTrack, decodeTrack }

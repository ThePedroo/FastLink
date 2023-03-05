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

    options.headers['User-Agent'] = 'FastLink@1.4.0'

    let request = https.request
    if (url.startsWith('http://')) request = http.request

    req = request(url, { port: options.port || 443, method: options.method || 'GET', headers: options.headers }, (res) => {
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

function reconnect(ws, Infos, map, x, informations) {
  ws = new WebSocket(`${x.secure ? 'wss://' : 'ws://'}${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`, undefined, {
    headers: {
      Authorization: x.password,
      'Num-Shards': informations.shards,
      'User-Id': informations.botId,
      'Client-Name': 'Fastlink@1.4.0'
    }
  })
  ws.on('open', () => onOpen(Infos, ws, x))
  ws.on('close', (code) => {
    let res = onClose(code, ws, Infos, map, x, informations)
    Infos = res.Infos
    ws = res.ws
  })
  ws.on('error', (error) => onError(error, x))
  ws.on('message', (data) => {
    Infos = onMessage(data, Infos, map, x)
  })
  return { ws, Infos }
}

function onOpen(Infos, ws, x) {
  Infos.Nodes[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = { Ws: ws, password: x.password, port: x.port || 443, stats: {} }

  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} connected`)
  Event.emit('nodeConnect', (x))
}

function onClose(code, ws, Infos, map, x, informations) {
  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} closed connection with code ${code}.`)

  let node = Infos.Nodes[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`]

  if (!node) node = { Reconnects: 0 }

  if (Infos.Configs.MaxTries <= -1 || node.Reconnects <= Infos.Configs.MaxTries) {
    setTimeout(() => {
      let res = reconnect(ws, Infos, map, x, informations)
      Infos = res.Infos
      ws = res.ws
    }, Infos.Configs.Delay)
  } else {
    node.Reconnects++

    let players = map.get('players') || {}
    let queues = map.get('queues') || {}

    Object.keys(players).map((x) => {
      if (players[x].node == `${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`) {
        delete players[x]
        delete queues[x]
      }
    })

    map.set('players', players)
    map.set('queues', queues)

    debug('Removed all players related to the offline node.')
    Event.emit('nodeClosed', (x, code))
  }
  Infos.Nodes[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = node

  return { ws, Infos }
}

function onError(error, x) {
  debug(`Failed to connect to node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''}, Error: ${error}`)

  Event.emit('nodeError', (x, error))
}

function onMessage(data, Infos, map, x) {
  if (data) data = JSON.parse(data)

  Event.emit('raw', data)

  if (data.type && data.op == 'event') debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.type.replace('Event', '')[0].toLowerCase()) ? 'An' : 'A'} ${data.type.replace('Event', '')[0].toLowerCase() + data.type.replace('Event', '').slice(1)} payload has been received.`)
  else debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.op.toLowerCase()[0]) ? 'An' : 'A'} ${data.op} payload has been received.`)

  switch (data.op) {
    case 'ready': {
      delete data.op
      
      Infos.Nodes[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].sessionId = data.sessionId

      Event.emit('ready', data)
    }
    case 'stats': {
      delete data.op

      Infos.Nodes[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].stats = data

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

                queue[data.guildId].shift()
              }
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

export default { makeRequest, debug, onOpen, onClose, onError, onMessage, getEvent }

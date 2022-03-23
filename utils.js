'use strict'

import event from 'events'
const Event = new event()

import https from 'https'
import http from 'http'

import WebSocket from 'ws'

function debug(message) {
  Event.emit('debug', message)
}

function makeRequest(url, options, Infos) {
  return new Promise((resolve) => {
    let req, data = ''
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      let node = Object.values(Infos.LoadBalancing).filter((x) => x.Ws._readyState === 1).sort((b, a) => a.Status.cpu ? (a.Status.cpu.systemLoad / a.Status.cpu.cores) * 100 : 0 - b.Status.cpu ? (b.Status.cpu.systemLoad / b.Status.cpu.cores) * 100 : 0)[0]
        
      if (!node) throw new Error('There is no node online.')
        
      debug(`Selected node ${node.Ws?._url.replace('ws://', '').replace('ws://', '')} for ${url.split('?')[0]}.`)
        
      url = `${node.Ws?._url.replace('ws://', 'http://').replace('ws://', 'https://')}/${url}`

      options = {
        headers: { 'Authorization': node.Password },
        port: node.Port,
        method: 'GET'
      }
    }

    options.headers['User-Agent'] = 'FastLink@1.3.1'
    
    let request = https.request
    if (url.startsWith('http://')) request = http.request

    req = request(url, { port: options.port || 443, method: options.method || 'GET', headers: options.headers }, (res) => {
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          let json = JSON.parse(data)
          resolve(json)
        } catch(err) {
          resolve(data)
        }
      })
    })

    req.on('error', (e) => {
      throw new Error(`Failed sending message`)
    })

    req.end()
  })
}

function reconnect(ws, Infos, sendJson, map, x, nodes, infos) {
  ws = new WebSocket(`${x.secure ? 'wss://' : 'ws://'}${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`, undefined, {
    headers: {
      Authorization: x.password,
      'Num-Shards': infos.shards,
      'User-Id': infos.botId,
      'Client-Name': 'Fastlink@1.3.1'
    }
  })
  ws.on('open', () => onOpen(Infos, ws, x, nodes))
  ws.on('close', (code) => {
    let res = onClose(code, ws, Infos, sendJson, map, x, nodes, infos)
    Infos = res.Infos
    ws = res.ws
  })
  ws.on('error', (error) => onError(error, nodes, x))
  ws.on('message', (data) => {
    Infos = onMessage(data, Infos, map, sendJson, x)
  })
  return { ws, Infos }
}

function onOpen(Infos, ws, x, nodes) {
  Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = { Ws: ws, Password: x.password, Port: x.port || '' }
    
  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} connected`)
  Event.emit('nodeConnect', (nodes))
}

function onClose(code, ws, Infos, sendJson, map, x, nodes, infos) {
  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} closed connection with code ${code}.`)
    
  if (!Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`]) {
    Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = {}
    Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Reconnects = 0
  }
  if (!Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Reconnects) Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Reconnects = 0
        
  if (!Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] || Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Reconnects <= 3) {
    setTimeout(() => {
      let res = reconnect(ws, Infos, sendJson, map, x, nodes, infos)
      Infos = res.Infos
      ws = res.ws
    }, 10000)
  } else {
    Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Reconnects++
      
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
    Event.emit('trackStart', (nodes, code))
  }
  return { ws: ws, Infos: Infos }
}
    
function onError(error, nodes, x) {
  debug(`Failed to connect to node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''}, Error: ${error}`)
    
  Event.emit('nodeError', (nodes, error))
}
    
function onMessage(data, Infos, map, sendJson, x) {
  if (data) data = JSON.parse(data)

  Event.emit('raw', data)
    
  if (data.type && data.op == 'event') debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.type.replace('Event', '')[0].toLowerCase()) ? 'An' : 'A'} ${data.type.replace('Event', '')[0].toLowerCase() + data.type.replace('Event', '').slice(1)} payload has been received.`)
  else debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.op.toLowerCase()[0]) ? 'An': 'A'} ${data.op} payload has been received.`)
  if (!data?.reason?.startsWith('FAKE_')) Event.emit('semiDebug', ` -  ${JSON.stringify(data)}`)

  switch (data.op) {
    case 'stats': {
      delete data.op

      Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Status = data

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
            
          if (!data.reason.startsWith('FAKE_')) Event.emit('trackEnd', data)

          if (Infos.Configs.Queue) {
            let queue = map.get('queue') || {}
            let players = map.get('players') || {}

            if (data.reason != 'REPLACED') {
              if (data.reason.startsWith('FAKE_TRACK_END') || queue[data.guildId] && queue[data.guildId][1]) {
                let track = data.track && data.reason.startsWith('FAKE_TRACK_END') ? data.track : queue[data.guildId][1]

                let response = sendJson({
                  op: 'play',
                  guildId: data.guildId,
                  track: track,
                  noReplace: typeof data.noReplace == 'boolean' ? data.noReplace : false,
                  pause: false
                }, players[data.guildId].node)
                if (response.error === true) throw new Error(response.message)

                if (data.reason.startsWith('FAKE_TRACK_END') && data.reason != 'FAKE_TRACK_END_SKIP') {
                  if (!queue[data.guildId]) queue[data.guildId] = []
                  queue[data.guildId].push(data.track)
                } else {
                  queue[data.guildId].shift()
                }
                
                players[data.guildId].track = track
              } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
                delete queue[data.guildId]
              }

              map.set('queue', queue)
            }
          }

          break
        }
        case 'TrackExceptionEvent': {   
          Event.emit('warn', 'Something broke while playing the track. This PROBABLY is not a FastLink\'s bug, do not submit a report [IF IT IS, PLEASE SUBMIT A BUG REPORT]. You ought to look the Lavalink\'s log, if it continues you should submit a bug report to Lavalink.')

          delete data.op
          delete data.type

          Event.emit('trackException', data)

          if (Infos.Configs.Queue) {
            let queue = map.get('queue') || {}
            let players = map.get('players') || {}

            if (queue[data.guildId] && queue[data.guildId][1]) {
              let response = sendJson({
                op: 'play',
                guildId: data.guildId,
                track: queue[data.guildId][1],
                noReplace: false,
                pause: false
              }, players[data.guildId].node)
              if (response.error === true) throw new Error(response.message)

              queue[data.guildId].shift()

              players[data.guildId].track = queue[data.guildId][0]
            } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
              delete queue[data.guildId]
            }

            map.set('queue', queue)
          }

          break
        }
        case 'TrackStuckEvent': {   
          Event.emit('warn', 'The track is stuck. This is not a FastLink\'s bug, do not submit a bug report. If it continues, please submit a bug report to Lavalink.')

          delete data.op
          delete data.type
          Event.emit('trackStuck', data)

          if (Infos.Configs.Queue) {
            let queue = map.get('queues') || {}
            let players = map.get('players') || {}

            if (queue[data.guildId] && queue[data.guildId][1]) {
              let response = sendJson({
                op: 'play',
                guildId: data.guildId,
                track: queue[data.guildId][1],
                noReplace: false,
                pause: false
              }, players[data.guildId].node)
              if (response.error === true) throw new Error(response.message)

              queue[data.guildId].shift()

              players[data.guildId].track = queue[data.guildId][0]
            } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
              delete queue[data.guildId]
            }

            map.set('queue', queue)
          }

          break
        }
        case 'WebSocketClosedEvent': {
          if (data.reason == 'Your session is no longer valid.') Event.emit('warn', `Session ID is no longer valid. You should check if you have the handleRaw, and if you are not using the method to connect to the voice channel of your Discord library.\nIn case of none of these are the problem, the problem is with FastLink, please submit a bug report.`)
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

export default { makeRequest, debug, onOpen, onClose, onError, onMessage, getEvent }

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

    options.headers['User-Agent'] = 'FastLink@1.3.5'

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

    req.end()
  })
}


async function search(music, createTrack) {
  let playlistRegex = /^.*(youtu.be\/|list=)([^#&?]*).*/.exec(music)
  let musicID = /(?:http?s?:\/\/)?(?:www.)?(?:m.)?(?:music.)?youtu(?:\.?be)(?:\.com)?(?:(?:\w*.?:\/\/)?\w*.?\w*-?.?\w*\/(?:embed|e|v|watch|.*\/)?\??(?:feature=\w*\.?\w*)?&?(?:v=)?\/?)([\w\d_-]{11})(?:\S+)?/g.exec(music)

  if (musicID && !playlistRegex) {
    makeRequest(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${musicID[1]}&format=json`, {
      headers: {},
      method: 'GET'
    }).then((musicName) => {
      if (musicName != 'Bad Request') music = musicName.title
      else return { loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] }
    })
  }

  let tracks = []
  let playlistInfo, html;

  if (playlistRegex) {
    html = await makeRequest(`https://www.youtube.com/playlist?list=${playlistRegex[2]}`, {
      headers: {},
      method: 'GET'
    })

    if (!html) return { loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] }

    try {
      playlistInfo = JSON.parse(html.split('"metadata":{"playlistMetadataRenderer":')[1].split('},"trackingParams":')[0])

      playlistInfo = { name: playlistInfo.title, selectedTrack: -1 }
    } catch (e) {
      return { loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] }
    }
  }

  if (!playlistRegex) html = await makeRequest(`https://www.youtube.com/results?search_query=${encodeURIComponent(music).replace(/[!'()*]/g, escape)}&sp=EgIQAQ%253D%253D`, {
    headers: {},
    method: 'GET'
  })

  try {
    html = JSON.parse(html.split('var ytInitialData =')[1].split('}}};')[0] + '}}}')
    if (html.contents.twoColumnBrowseResultsRenderer ?.tabs[0] ?.tabRenderer) tracks = html.contents ?.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents
    else if (html.contents.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer) tracks = html.contents.twoColumnSearchResultsRenderer?.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents
  } catch (e) {
    return { loadType: 'NO_MATCHES', playlistInfo: {}, tracks: [] }
  }

  let index = 0
  tracks.forEach((data) => {
    if (data.videoRenderer == undefined && data.playlistVideoRenderer == undefined) return tracks.splice(index, 1)

    if (data.videoRenderer) {
      let length = data.videoRenderer.lengthText ? data.videoRenderer.lengthText.simpleText : 0
      if (length !== 0) length = length.split(':')

      if (length && length.length === 3) length = (Number(length[0]) * 3600000) + (Number(length[1]) * 60000) + (Number(length[2]) * 1000)
      else if (length) length = (Number(length[0]) * 60000) + (Number(length[1]) * 1000)

      let info = {
        identifier: data.videoRenderer.videoId,
        isSeekable: true,
        author: data.videoRenderer.ownerText.runs[0].text,
        length,
        isStream: data.videoRenderer.badges !== undefined ? true : false,
        position: 0,
        title: data.videoRenderer.title.runs[0].text,
        uri: `https://www.youtube.com/watch?v=${data.videoRenderer.videoId}`,
        artwork: data.videoRenderer.thumbnail.thumbnails[0].url,
        sourceName: 'youtube'
      }

      tracks[index] = {
        track: createTrack == true ? encodeTrack(info) : null,
        info
      }
      index++
    } else {
      let length = data.playlistVideoRenderer.lengthText ? data.playlistVideoRenderer.lengthText.simpleText : 0
      if (length != 0) length = length.split(':')

      if (length && length.length == 3) length = (Number(length[0]) * 3600000) + (Number(length[1]) * 60000) + (Number(length[2]) * 1000)
      else if (length) length = (Number(length[0]) * 60000) + (Number(length[1]) * 1000)

      let info = {
        identifier: data.playlistVideoRenderer.videoId,
        isSeekable: true,
        author: data.playlistVideoRenderer.shortBylineText.runs[0].text,
        length,
        isStream: data.playlistVideoRenderer.badges !== undefined ? true : false,
        position: 0,
        title: data.playlistVideoRenderer.title.runs[0].text,
        uri: `https://www.youtube.com/watch?v=${data.playlistVideoRenderer.videoId}`,
        artwork: data.playlistVideoRenderer.thumbnail.thumbnails[0].url,
        sourceName: 'youtube'
      }

      tracks[index] = {
        track: createTrack == true ? encodeTrack(info) : null,
        info
      }
      index++
    }
  })

  return { loadType: playlistInfo ? 'PLAYLIST_LOADED' : 'SEARCH_RESULT', playlistInfo: playlistInfo || {}, tracks }
}

function reconnect(ws, Infos, sendJson, map, x, informations) {
  ws = new WebSocket(`${x.secure ? 'wss://' : 'ws://'}${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`, undefined, {
    headers: {
      Authorization: x.password,
      'Num-Shards': informations.shards,
      'User-Id': informations.botId,
      'Client-Name': 'Fastlink@1.3.5'
    }
  })
  ws.on('open', () => onOpen(Infos, ws, x))
  ws.on('close', (code) => {
    let res = onClose(code, ws, Infos, sendJson, map, x, informations)
    Infos = res.Infos
    ws = res.ws
  })
  ws.on('error', (error) => onError(error, x))
  ws.on('message', (data) => {
    Infos = onMessage(data, Infos, map, sendJson, x)
  })
  return { ws, Infos }
}

function onOpen(Infos, ws, x) {
  Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = { Ws: ws, Password: x.password, Port: x.port || 443, Stats: {} }

  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} connected`)
  Event.emit('nodeConnect', (x))
}

function onClose(code, ws, Infos, sendJson, map, x, informations) {
  debug(`Node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''} closed connection with code ${code}.`)

  let node = Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`]

  if (!node) node = {}
  if (!node.Reconnects) node = { Reconnects: 0 }

  if (Infos.Configs.MaxTries <= -1 || node.Reconnects <= Infos.Configs.MaxTries) {
    setTimeout(() => {
      let res = reconnect(ws, Infos, sendJson, map, x, informations)
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
  Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`] = node

  return { ws, Infos }
}

function onError(error, x) {
  debug(`Failed to connect to node ${x.hostname}${x.port != undefined ? `:${x.port}` : ''}, Error: ${error}`)

  Event.emit('nodeError', (x, error))
}

function onMessage(data, Infos, map, sendJson, x) {
  if (data) data = JSON.parse(data)

  Event.emit('raw', data)

  if (data.type && data.op == 'event') debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.type.replace('Event', '')[0].toLowerCase()) ? 'An' : 'A'} ${data.type.replace('Event', '')[0].toLowerCase() + data.type.replace('Event', '').slice(1)} payload has been received.`)
  else debug(`${['a', 'e', 'i', 'o', 'u'].includes(data.op.toLowerCase()[0]) ? 'An' : 'A'} ${data.op} payload has been received.`)
  if (!data.reason ?.startsWith('FAKE_')) Event.emit('semiDebug', ` -  ${JSON.stringify(data)}`)

  switch (data.op) {
    case 'stats': {
      delete data.op

      Infos.LoadBalancing[`${x.hostname}${x.port != undefined ? `:${x.port}` : ''}`].Stats = data

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

          let queue = map.get('queue') || {}

          data.track = queue[data.guildId][0]

          Event.emit('trackStart', data)
          break
        }
        case 'TrackEndEvent': {
          delete data.op
          delete data.type

          if (Infos.Configs.Queue) {
            let queue = map.get('queue') || {}
            let players = map.get('players') || {}

            if (data.reason != 'REPLACED' && data.reason != 'STOPPED' && data.reason != 'LOAD_FAILED') {
              data.track = data.track && data.reason.startsWith('FAKE_TRACK_END') ? data.track : queue[data.guildId][0]

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
          } else {
            if (data.reason == 'LOAD_FAILED') throw new Error('This is really bad, and shouldn\'t happen! Please report to the FastLink\'s owner ASAP.', data)
          }

          if (!data.reason.startsWith('FAKE_')) Event.emit('trackEnd', data)
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
              let response = sendJson({
                op: 'play',
                guildId: data.guildId,
                track: queue[data.guildId][1],
                noReplace: false,
                pause: false
              }, players[data.guildId].node)
              if (response.error == true) throw new Error(response.message)

              queue[data.guildId].shift()

              players[data.guildId].track = queue[data.guildId][0]
            } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
              delete queue[data.guildId]
            }

            map.set('queue', queue)
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
              let response = sendJson({
                op: 'play',
                guildId: data.guildId,
                track: queue[data.guildId][1],
                noReplace: false,
                pause: false
              }, players[data.guildId].node)
              if (response.error == true) throw new Error(response.message)

              queue[data.guildId].shift()

              players[data.guildId].track = queue[data.guildId][0]
            } else if (queue[data.guildId] && queue[data.guildId][0] && !queue[data.guildId][1]) {
              delete queue[data.guildId]
            }

            map.set('queue', queue)
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

class DecodeClass {
  constructor(buffer, positionDefault) {
    this.position = positionDefault
    this.buffer = buffer
  }

  changeBytes(bytes) {
    this.position += bytes
    return this.position - bytes
  }

  read(type) {
    switch (type) {
      case 'byte':
        return this.buffer[this.changeBytes(1)]
      case 'unsignedShort':
        return this.buffer.readUInt16BE(this.changeBytes(2))
      case 'int':
        return this.buffer.readInt32BE(this.changeBytes(4))
      case 'long':
        const msb = this.read('int')
        const lsb = this.read('int')

        return BigInt(msb) * BigInt(2 ** 32) + BigInt(lsb)
      case 'utf':
        const lenght = this.read('unsignedShort')
        const start = this.changeBytes(lenght)
        return this.buffer.toString('utf8', start, start + lenght)
    }
  }
}

function encodeTrack(obj) {
  const out = new EncodeClass()

  out.write('byte', 2)
  out.write('utf', obj.title)
  out.write('utf', obj.author)
  out.write('long', BigInt(obj.length))
  out.write('utf', obj.identifier)
  out.write('byte', obj.isStream ? 1 : 0)
  out.write('byte', obj.uri ? 1 : 0)
  if (obj.uri) out.write('utf', obj.uri)
  out.write('utf', obj.sourceName)
  out.write('long', BigInt(obj.position))
  out.write('byte', obj.isSeekable ? 1 : 0)
  out.write('utf', obj.artwork)

  const buffer = out.result()
  const result = Buffer.alloc(buffer.length + 4)

  result.writeInt32BE(buffer.length | (1 << 30))
  buffer.copy(result, 4)

  return result.toString('base64')
}

function getEvent() {
  return Event
}

export default { makeRequest, search, debug, onOpen, onClose, onError, onMessage, DecodeClass, encodeTrack, getEvent }

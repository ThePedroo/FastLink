<div align="center">
  <br>
    <br>
      <a href="https://discord.gg/ut6qxsgtME"><img src="https://img.shields.io/discord/948014684630560768?color=5865F2&logo=discord&logoColor=white" alt="Discord server"/></a>
    </br>
  </br>
</div>

FastLink. Lightweight, memory-efficient Lavalink wrapper using Node.js.

# Informations

  Support server: <https://discord.gg/ut6qxsgtME>
  
  Developer Discord Tag: Pedro.js#9446

# Observations

  Do NOT use functions to join voice channel of your library, they will handle voiceUpdate, and Lavalink already do that.

## Before using the functions

  Before you use the function, import the FastLink in your code with:

  ```js
  const Lavalink = require('fastlink')
  // or with ES6
  import Lavalink from 'fastlink'
  ```

## Connect Node

  Connects to a Lavalink node.

  ```js
  connectNode([{ host: <String>, secure: <Boolean>, password: <String>, port: <Int or boolean> }], { shards: <Int>, botId: <PRIu64 or String>, handleQueue: <Boolean> }, <Function>)
  ```

  Example:

  ```js
  // Discord.js example

  Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.cache.get(guildId).shard.send(payload)
  })

  // Eris example

  Lavalink.connectNode([{ host: 'example.com', secure: true, password: 'youshallnotpass', port: undefined }], { shards: 1, botId: '1234567891011121314' }, (guildId, payload) => {
    client.guilds.get(guildId).shard.ws.send(payload)
  })
  ```

  Observation: Just one node is supported for now, and handleQueue will make FastLink make and handle a music queue.

## Handle Discord Raw event

  Handle the Discord Raw Event for send for Lavalink, it's necessary for play a music.

  ```js
  handleRaw(<Object>)
  ```

  Example:

  ```js
  client.on('raw', (data) => Lavalink.handleRaw(data)) // Discord.Js
  client.on('rawWS', (data) => Lavalink.handleRaw(data)) // Eris
  ```

## Get Lavalink Events

  Get the Lavalink events.

  ```js
  getLavalinkEvents()
  ```

  Example:

  ```js
  let events = Lavalink.getLavalinkEvents()

  events.on('trackStart', () => console.log('Track started'))
  ```

  Observation: It can emit "nodeConnect", "nodeClose", "nodeError", "raw", "stats", "playerUpdate", "trackStart", "TrackStuck", "TrackEnd", "TrackException", "WebSocketClosed", "unknownType" and "unknownOp" events.

## createPlayer

  Creates a player in a server.  

  ```js
  createPlayer({ guildId: <PRIu64 or String>, voiceChannelId: <PRIu64 or String> })
  ```

  Example:

  ```js
  const player = Lavalink.createPlayer({ guildId: '1234567891011121314', voiceChannelId: '1234567891011121314' })
  ```

## Get Player

  Gets a player, for start create a player, see createPlayer.

  ```js
  getPlayer(<PRIu64 or String>)
  ```

  Example:

  ```js
  const player = Lavalink.getPlayer('1234567891011121314')

  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)
  ```

## Get Queue

  Gets a queue, good for see what's the current music and see what's next.

  ```js
  getQueue(<PRIu64 or String>)
  ```

  Example:

  ```js
  const queue = Lavalink.getQueue('1234567891011121314')

  console.log(queue)
  ```

## Get all Players

  Get all players, paused, playing or stopped.

  ```js
  getAllPlayers()
  ```

  Example:

  ```js
  const players = Lavalink.getAllPlayers()

  players.forEach((x) => console.log(x))
  ```

## Get all Queues

  Get all queues with musics.

  ```js
  getAllQueues()
  ```

  Example:

  ```js
  const queues = Lavalink.getAllQueues()

  queues.forEach((x) => console.log(x))
  ```

### Connect

  Connect the bot into the voice channel. Use that instead of the Discord wrapper function that you are using.

  ```js
  <Player>.connect()
  ```

  Example:

  ```js
  const player = Lavalink.createPlayer({ guildId: '1234567891011121314', voiceChannelId: '1234567891011121314' })

  player.connect()
  ```

### Play Music

  Starts playing a music.

  ```js
  <Player>.play(<String>)
  ```

  Example:

  ```js
  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)
  ```

### Search

  Search for musics similar or equal to the url / name.

  ```js
  <Player>.search(<String>)
  ```

  Example:

  ```js
  let track = player.search('Rick roll')
  ```

### Stop

  Stops a player.

  ```js
  <Player>.stop()
  ```

  Example:

  ```js
  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)

  setTimeout(() => {
    player.stop()
  }, 5000)
  ```

### Destroy

  Destroys a player.

  ```js
  <Player>.destroy()
  ```

  Example:

  ```js
  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)

  setTimeout(() => {
    player.stop()
  }, 5000)
  ```

### Set volume

  Changes a volume from a player.

  ```js
  <Player>.setVolume(<Integer or String>)
  ```

  Example:

  ```js
  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)
  player.setVolume(200)
  ```

### Set paused

  Pauses or resumes a player.

  ```js
  <Player>.setPaused(<Boolean>)
  ```

  Example:
  
  ```js
  let track = player.search('Rick roll')

  player.play(track.tracks[0].track)

  setTimeout(() => {
    player.setPaused()
    setTimeout(() => {
      player.setPaused(false)
    }, 2000)
  }, 5000)    
  ```

  Observation: If parameter is not specified, default is true.

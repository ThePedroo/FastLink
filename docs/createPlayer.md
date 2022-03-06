# createPlayer

  Creates a player in a server.  

  ```js
  createPlayer({ guildId: <PRIu64 or String>, voiceChannelId: <PRIu64 or String> })
  ```

## Example

  ```js
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id }) // Discord.js
  
  const player = Lavalink.createPlayer({ guildId: message.guildID, voiceChannelId: message.member.voiceState.channelID }) // Eris
  ```
  
## Observations

  You will need this function for use the [connect](docs/connect.md), [getQueue](docs/getQueue.md), [play](docs/play.md), [search](docs/search.md), [stop](docs/stop.md), [destroy](docs/destroy.md), [setVolume](docs/setVolume.md) and [setPaused](docs/setPaused.md) functions. They are necessary for the bot to play a music.

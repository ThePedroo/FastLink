# createPlayer

  Creates a player in a server.  

  ```js
  createPlayer({ guildId: <PRIu64 or String>, voiceChannelId: <PRIu64 or String> })
  ```

## Example

  ```js
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id }) // Discord.js
  
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voiceState.channelID }) // Discord.js
  ```
  
## Observation

  You will need this function for use the connect, play, search, stop, destroy, setVolume and setPaused functions. They are necessary for the bot to play a music.

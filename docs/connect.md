# Connect

  Connect the bot into the voice channel. Use that instead of the Discord wrapper function that you are using.

  ```js
  <Player>.connect()
  ```

## Example

  ```js
  // Discord.js example
  
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id })

  player.connect()
  
  
  // Eris example
  
  const player = Lavalink.createPlayer({ guildId: message.guildID, voiceChannelId: message.member.voiceState.channelID })
  
  player.connect()
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.

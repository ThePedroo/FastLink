# Set volume

  Changes a volume from a player.

  ```js
  <Player>.setVolume(<Integer or String>)
  ```

## Example


  ```js
  // Discord.js example
  
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id })
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)
  player.setVolume(200)
  
  
  // Eris example
  
  const player = Lavalink.createPlayer({ guildId: message.guildID, voiceChannelId: message.member.voiceState.channelID })
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)
  player.setVolume(200)
  ```
  
  ## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.
  
  If the first parameter is not specified, default is true.
  

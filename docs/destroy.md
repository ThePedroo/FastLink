# Destroy

  Destroys a specific player, it stops the currect music, cannot play another music without new player.

  ```js
  <Player>.destroy()
  ```
## Example

  ```js
  // Discord.js example
  
  const player = Lavalink.createPlayer({ guildId: message.guild.id, voiceChannelId: message.member.voice.channel.id })
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)

  setTimeout(() => player.destroy(), 5000)
  
  
  // Eris example
  
  const player = Lavalink.createPlayer({ guildId: message.guildID, voiceChannelId: message.member.voiceState.channelID })
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].track)

  setTimeout(() => player.destroy(), 5000)
  ```
  
## Observation

  This is a function from the [createPlayer](docs/createPlayer.md)/[getPlayer](docs/getPlayer.md) functions. You **will** need one of them for use this function.

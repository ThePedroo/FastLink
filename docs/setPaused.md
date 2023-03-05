# Set paused

  Pauses or resumes a player.

  ```js
  <Player>.setPaused(<Boolean>)
  ```

## Example


  ```js
  ...
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].encoded)

  setTimeout(() => {
    player.setPaused()
    setTimeout(() => {
      player.setPaused(false)
    }, 2000)
  }, 5000)
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.

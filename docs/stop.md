# Stop

  Stops a specific player.

  ```js
  <Player>.stop()
  ```

## Example

  ```js
  ...
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].encoded)

  setTimeout(() => player.stop(), 5000)
  ```
  
## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.

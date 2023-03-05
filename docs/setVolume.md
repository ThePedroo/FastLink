# Set volume

  Changes a volume from a player.

  ```js
  <Player>.setVolume(<Integer or String>)
  ```

## Example


  ```js  
  ...
  
  let track = player.search('Rick Astley - Never Gonna Give You Up')

  player.play(track.tracks[0].encoded)
  player.setVolume(200)
  
  ## Observations

  This is a function from the [createPlayer](createPlayer.md)/[getPlayer](getPlayer.md) functions. You **will** need one of them for use this function.
  
  If the first parameter is not specified, default is true.
  

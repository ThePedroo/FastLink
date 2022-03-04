# Get Lavalink Events

  Get the events sent by the Lavalink.

  ```js
  getLavalinkEvents()
  ```

## Example

  ```js
  let events = Lavalink.getLavalinkEvents()

  events.on('trackStart', (track) => console.log('Track started'))
  events.on('trackEnd', (track) => console.log('Track ended'))
  ```

## Observation

  This function can emit several events, like: 
  
  ```text
  Node: nodeConnect, nodeClose, nodeError.
  Status: raw, stats, playerUpdate.
  Events: trackStart, TrackStuck, TrackEnd, TrackException, WebSocketClosed.
  Unknown: unknownType, unknownOp.
  ```

## Handle Discord Raw event

  Handle the Discord Raw Event for send for Lavalink, it's necessary for play a music.

  ```js
  handleRaw(<Object>)
  ```

## Example

  ```js
  client.on('raw', (data) => Lavalink.handleRaw(data)) // Discord.js
  
  client.on('rawWS', (data) => Lavalink.handleRaw(data)) // Eris
  ```
  
## Observations
  
  This is necessary for the library to work.
  
  This will work for other libraries than Discord.js and Eris, but it depends from the mode of use.

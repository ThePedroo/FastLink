FastLink <a href="https://discord.gg/ut6qxsgtME"><img src="https://img.shields.io/discord/948014684630560768?color=5865F2&logo=discord&logoColor=white" alt="Discord server"/></a> [![FastLink package size](https://packagephobia.now.sh/badge?p=fastlink)](https://packagephobia.now.sh/result?p=fastlink)
====

A lightweight, memory-efficient Lavalink wrapper using Node.js.

# Documentation

  Here you will find example and explanations for all FastLink's functions.
  
## Not playing the music?

  Do NOT use functions to join voice channel of your library, they will handle voiceUpdate, and Lavalink already do that. Using it can make the music to don't be played.

## Before using a FastLink's function

  Import the FastLink in your code with:

  ```js
  // CommonJs
  const Lavalink = require('fastlink') // This will not work, recommended to use ES6 instead.


  // ES6
  import Lavalink from 'fastlink'
  ```


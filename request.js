import https from 'https'
import http from 'http'

function makeRequest(url, options) {
  return new Promise((resolve) => {
    let req, data = ''

    if (url.startsWith('https://')) {
      req = https.request(url, { port: options.port, method: options.method, headers: options.header }, (res) => {
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => resolve(data ? JSON.parse(data) : data))
      })
    } else if (url.startsWith('http://')) {
      req = http.request(url, { port: options.port, method: options.method, headers: options.header }, (res) => {
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => resolve(data ? JSON.parse(data) : data))
      })
    }

    if (req) req.on('error', (e) => {
      throw new Error(e)
    })

    req.end()
    
  })
}

export default makeRequest

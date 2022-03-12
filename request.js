import https from 'https'
import http from 'http'

/**
 * Makes a request to a website.
 * @param {string} url - The website URL.
 * @param {{ port: number, method: string, headers: object }} options - The options for access the site.
 * @returns {Promise<?>} Returns the response from the website.
 */
function makeRequest(url, options) {
  return new Promise((resolve) => {
    let req, data = ''

    options.headers['User-Agent'] = 'FastLink@1.2.2'

    if (url.startsWith('https://')) {
      req = https.request(url, { port: options.port, method: options.method, headers: options.headers }, (res) => {
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          try {
            let json = JSON.parse(data)
            resolve(json)
          } catch(err) {
            resolve(data)
          }
        })
      })
    } else if (url.startsWith('http://')) {
      req = http.request(url, { port: options.port, method: options.method, headers: options.headers }, (res) => {
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          try {
            let json = JSON.parse(data)
            resolve(json)
          } catch(err) {
            resolve(data)
          }
        })
      })
    }

    if (req) req.on('error', (e) => {
      throw new Error(e)
    })

    req.end()
  })
}

export default makeRequest
const {http, https} = require('follow-redirects')
const {randomInt} = require('crypto')

function choose(...choices) {
  return choices[randomInt(choices.length)]
}

async function streaming(url, options) {
  console.log('Streaming from', url)
  return await new Promise((resolve,reject)=>{
    https.get(url, {headers:options?.headers}, res=>{
      resolve(res)
    }).on('error', e => {reject(e)})
  })
}

function getHttp(url, options) {
  return new Promise((resolve, reject)=>{
    http.get(url, {headers:options?.headers}, res=>{
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (options?.log) {console.log('GET', res.statusCode, url)}
        resolve({data, statusCode:res.statusCode})
      })
      res.on('error', e => reject(e))
    })
  })
}

function getHttps(url, options) {
  return new Promise((resolve, reject)=>{
    https.get(url, {headers:options?.headers}, res=>{
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (options?.log) {console.log('GET', res.statusCode, url)}
        resolve({data, statusCode:res.statusCode})
      })
      res.on('error', e => reject(e))
    })
  })
}

function postHttps(url, options) {
  if (options?.data === undefined) throw new Error('No data')
  return new Promise((resolve, reject)=>{
    const req = https.request(
      url, Object.assign({method:'POST'}, {headers:options?.headers}), (res)=>{
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          if (options?.log) {console.log('POST', res.statusCode, url)}
          resolve({data, statusCode:res.statusCode})
        })
        res.on('error', e => reject(e))
    })
    if (options?.timeout) req.setTimeout(options.timeout)
    req.write(options.data)
    req.end()
  })
}

function postHttp(url, options) {
  if (options?.data === undefined) throw new Error('No data')
  return new Promise((resolve, reject)=>{
    const req = http.request(
      url, Object.assign({method:'POST'}, {headers:options?.headers}), (res)=>{
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          if (options?.log) {console.log('POST', res.statusCode, url)}
          resolve({data, statusCode:res.statusCode})
        })
        res.on('error', e => reject(e))
    })
    req.write(options.data)
    req.end()
  })
}

module.exports = {
  choose, streaming, getHttp, getHttps, postHttps, postHttp
}
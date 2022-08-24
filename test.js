const fs = require('fs')
const {JSDOM} = require('jsdom')
const {streaming, getHttp, getHttps} = require('./extra/tools')

const ghHeaders = {
  'user-agent' : 'aidulcandra',
  'authorization' : 'token ' + process.env.GITHUB_TOKEN
}

;(async()=>{
  const id = ''
  const page = await getHttps(
    `https://api.vevioz.com/api/button/mp3/kXYiU_JCYtU`
  )
  const doc = new JSDOM(page.data).window.document
  const link = doc.querySelector('.download > a:nth-child(4)').getAttribute('href')
  const w = fs.createWriteStream('./test.mp3')
  const stream = await streaming(link)
  stream.pipe(w)
})()


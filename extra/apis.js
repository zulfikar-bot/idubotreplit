const {randomInt} = require('crypto')
const {JSDOM} = require('jsdom')
const {getHttp, getHttps, postHttps, postHttp} = require('./tools')

const cache = {}

const roboHash = {
  makeUrl: (string, set) => `https://robohash.org/${string}.jpeg?set=set${set}`
}

const openDrive = {
  login: async (username, password) => {
    const auth = `username=${username}&passwd=${password}`
    const url = 'https://dev.opendrive.com/api/v1/session/login.json?'+auth
    const response = await postHttps(url, {data:''}, true)
    return JSON.parse(response.data).SessionID
  },
  listFolder: async (sessionId, folderId) => {
    const cacheKey = 'opendrive_'+folderId
    if (cache[cacheKey]) return JSON.parse(cache[cacheKey])
    const url = `https://dev.opendrive.com/api/v1/folder/list.json/${sessionId}/${folderId}`
    const response = await getHttps(url)
    cache[cacheKey] = response.data
    return JSON.parse(response.data).Files
  },
  logout: (sessionId) => {
    const url = 'https://dev.opendrive.com/api/v1/session/logout.json?session_id='+sessionId
    return postHttps(url, {data:''}, true)
  }
}

const cambridgeDictionary = {
  enid: async (keyword, direction) => {
    const dirMap = {
      'ei': 'english-indonesian',
      'ie': 'indonesian-english'
    }
    const page = await getHttps(`https://dictionary.cambridge.org/dictionary/${dirMap[direction]}/${keyword}`)
    const doc = new JSDOM(page.data).window.document
    const results = []
    const items = Array.from(doc.querySelectorAll('.di-head, .di-body'))
    for (;items.length;) {
      const head = items.shift()
      const body = items.shift()
      const results2 = []
      const senses = Array.from(body.querySelectorAll('.sense-body'))
      for (;senses.length;) {
        const sense = senses.shift()
        results2.push({
          def: sense.querySelector('.ddef_d')?.textContent,
          trans: sense.querySelector('.dtrans').textContent,
          ex: Array.from(sense.querySelectorAll('.dexamp')).map(ee=>ee.textContent.replaceAll(/^ /g,'')),
        })
      }
      const pron = head.querySelector('.dipa')?.textContent
      const pushObject = {
        word: head.querySelector('.di-title').textContent,
        pos: head.querySelector('.dpos')?.textContent,
        pron: pron && `/${pron}/`,
        senses: results2
      }
      if (pushObject.senses.length) results.push(pushObject)
    }
    return results
  }
}

const freeDictionary = {
  getDefinition : async (keyword) => {
    const cacheKey = 'freedic_'+keyword
    if (cache[cacheKey]) return JSON.parse(cache[cacheKey])
    const result = await getHttps('https://api.dictionaryapi.dev/api/v2/entries/en/'+keyword)
    cache[cacheKey] = result.data
    return JSON.parse(result.data)
  }
}

const ozdic = {
  collocation : async (keyword) => {
    const cacheKey = 'ozdic_col_'+keyword
    if (cache[cacheKey]) return cache[cacheKey]
    const page = await getHttps(`https://ozdic.com/collocation/${keyword}.txt`)
    const doc = new JSDOM(page.data).window.document  
    const result = []
    const items = doc.querySelectorAll('div.item')
    items.forEach(divE => {
      const item = {
        word: divE.querySelector('.word > b').textContent.replaceAll(/^ +/g,'').replaceAll(/ +$/g,''),
        pos: divE.querySelector('.word > i').textContent.replaceAll(/^ +/g,'').replaceAll(/ +$/g,''),
        rows:[],
      }
      const rows = divE.querySelectorAll('p:not(.word) > *')
      rows.forEach(rowE => item.rows.push({[rowE.tagName]:rowE.textContent.replaceAll(/^ +/g,'').replaceAll(/ +$/g,'')}))
      result.push(item)
    })
    cache[cacheKey] = result
    return result
  }             
}

const soundOfText = {
  tts: async (text, voice) => {
    const data = {engine: "Google", data: {text, voice}}
    const result = await postHttps(
      'https://api.soundoftext.com/sounds',
      {
        headers: {'Content-Type':'application/json'},
        data: JSON.stringify(data)
      }
    )
    const {id} = JSON.parse(result.data)
    let url = ''
    let retries = 10
    while (true) {
      const request = await getHttps(`https://api.soundoftext.com/sounds/${id}`)
      const check = JSON.parse(request.data)
      if (check.status === 'Done') {url = check.location; break}
      await new Promise(resolve=>setTimeout(resolve,1000))
      retries --
      if (!retries) return null
    }
    return url
  }
}

const randomWord = {
  idiom: async () => {
    const page = await getHttps('https://randomword.com/idiom')
    const doc = new JSDOM(page.data).window.document
    const idiom = doc.querySelector('#random_word').textContent
    const meaning = doc.querySelector('#random_word_definition').textContent
    return {idiom, meaning}
  }
}

const forismatic = {
  quote: async () => {
    const response = await getHttps('https://api.forismatic.com/api/1.0/?method=getQuote&lang=en&format=json')
    const result = JSON.parse(response.data.replaceAll("\\'", "'"))
    return { quote:result.quoteText, author:result.quoteAuthor }
  }
}

const fisenko = {
  quote: async () => {
    const response = await getHttps('https://api.fisenko.net/v1/quotes/en/random')
    const result = JSON.parse(response.data)
    return { quote:result.text, author:result.author?.name }
  }
}

const jokeApi = {
  joke: async () => {
    const response = await getHttps('https://v2.jokeapi.dev/joke/Miscellaneous,Pun?blacklistFlags=nsfw,religious,racist&format=txt')
    return response.data
  }
}

const iCanHazDadJoke = {
  joke: async () => {
    const headers = {Accept:'text/plain'}
    const response = await getHttps('https://icanhazdadjoke.com/', {headers})
    return response.data
  }
}

const uselessFacts = {
  fact: async () => {
    const response = await getHttps('https://uselessfacts.jsph.pl/random.json?language=en')
    const {text} = JSON.parse(response.data)
    return text
  }
}

const asliFunFact = {
  fact: async () => {
    const response = await getHttps('https://asli-fun-fact-api.herokuapp.com/')
    const {data:{fact}} = JSON.parse(response.data)
    return fact
  }
}

const adviceSlip = {
  advice: async () => {
    const response = await getHttps('https://api.adviceslip.com/advice')
    const {slip:{advice}} = JSON.parse(response.data)
    return advice
  }
}

const googleTranslate = {
  translate: async (from, to, text) => {
    const t = await postHttp(
      'http://idul-pup-services.herokuapp.com/translate',
      {data:JSON.stringify({from,to,text}), log:true, timeout:5*60*1000},
    ) 
    return JSON.parse(t.data)
  }, 
  languages: [
    { name: 'Afrikaans', code: 'af' },
    { name: 'Albanian', code: 'sq' },
    { name: 'Arabic', code: 'ar' },
    { name: 'Azerbaijani', code: 'az' },
    { name: 'Basque', code: 'eu' },
    { name: 'Bengali', code: 'bn' },
    { name: 'Belarusian', code: 'be' },
    { name: 'Bulgarian', code: 'bg' },
    { name: 'Catalan', code: 'ca' },
    { name: 'Chinese Simplified', code: 'zh-CN' },
    { name: 'Chinese Traditional', code: 'zh-TW' },
    { name: 'Croatian', code: 'hr' },
    { name: 'Czech', code: 'cs' },
    { name: 'Danish', code: 'da' },
    { name: 'Dutch', code: 'nl' },
    { name: 'English', code: 'en' },
    { name: 'Esperanto', code: 'eo' },
    { name: 'Estonian', code: 'et' },
    { name: 'Filipino', code: 'tl' },
    { name: 'Finnish', code: 'fi' },
    { name: 'French', code: 'fr' },
    { name: 'Galician', code: 'gl' },
    { name: 'Georgian', code: 'ka' },
    { name: 'German', code: 'de' },
    { name: 'Greek', code: 'el' },
    { name: 'Gujarati', code: 'gu' },
    { name: 'Haitian Creole', code: 'ht' },
    { name: 'Hebrew', code: 'iw' },
    { name: 'Hindi', code: 'hi' },
    { name: 'Hungarian', code: 'hu' },
    { name: 'Icelandic', code: 'is' },
    { name: 'Indonesian', code: 'id' },
    { name: 'Irish', code: 'ga' },
    { name: 'Italian', code: 'it' },
    { name: 'Japanese', code: 'ja' },
    { name: 'Javanese', code: 'jw' },
    { name: 'Kannada', code: 'kn' },
    { name: 'Korean', code: 'ko' },
    { name: 'Latin', code: 'la' },
    { name: 'Latvian', code: 'lv' },
    { name: 'Lithuanian', code: 'lt' },
    { name: 'Macedonian', code: 'mk' },
    { name: 'Malay', code: 'ms' },
    { name: 'Maltese', code: 'mt' },
    { name: 'Norwegian', code: 'no' },
    { name: 'Persian', code: 'fa' },
    { name: 'Polish', code: 'pl' },
    { name: 'Portuguese', code: 'pt' },
    { name: 'Romanian', code: 'ro' },
    { name: 'Russian', code: 'ru' },
    { name: 'Serbian', code: 'sr' },
    { name: 'Slovak', code: 'sk' },
    { name: 'Slovenian', code: 'sl' },
    { name: 'Spanish', code: 'es' },
    { name: 'Sundanese', code: 'su' },
    { name: 'Swahili', code: 'sw' },
    { name: 'Swedish', code: 'sv' },
    { name: 'Tamil', code: 'ta' },
    { name: 'Telugu', code: 'te' },
    { name: 'Thai', code: 'th' },
    { name: 'Turkish', code: 'tr' },
    { name: 'Ukrainian', code: 'uk' },
    { name: 'Urdu', code: 'ur' },
    { name: 'Vietnamese', code: 'vi' },
    { name: 'Welsh', code: 'cy' },
    { name: 'Yiddish', code: 'yi' }
  ]
}

const bba = {
  githubHeaders: {
    'user-agent' : 'aidulcandra',
    'authorization' : 'token ' + process.env.GITHUB_TOKEN
  },
  english: {
    readRecord: async () => {
      const dirKey = 'bba_en_rr_filelist'
      if (!cache[dirKey]) cache[dirKey] = JSON.parse((await getHttps(
        `https://api.github.com/repos/aidulcandra/materi-bahasa-asing/contents/en/other/readrecord`,
        {headers:bba.githubHeaders}
      )).data)
      const dir = cache[dirKey]
      const id = randomInt(dir.length)
      rrKey = 'bba_en_rr_' + id
      if (cache[rrKey]) return cache[rrKey]
      const response = await getHttps(dir[id].download_url)
      return response.data
    },
    tongueTwister: async () => {
      const dirKey = 'bba_en_tt_filelist'
      if (!cache[dirKey]) cache[dirKey] = JSON.parse((await getHttps(
        `https://api.github.com/repos/aidulcandra/materi-bahasa-asing/contents/en/other/tonguetwister`,
        {headers:bba.githubHeaders}
      )).data)
      const dir = cache[dirKey]
      const id = randomInt(dir.length)
      rrKey = 'bba_en_tt_' + id
      if (cache[rrKey]) return cache[rrKey]
      const response = await getHttps(dir[id].download_url)
      return response.data
    }
  },
  japanese: {
    kanji: async (input) => {
      const results = []
      const addedKanjis = []
      const kanjiDB = await bba.japanese.kanjiDB()
      for (const i of input) {
        const kanjiData = kanjiDB.filter(k=>{
          if (k.character===i) return true
        })
        kanjiData.forEach(k=>{
          if (addedKanjis.includes(k.character)) return
          addedKanjis.push(k.character)
          results.push(k)
        })
      }
      for (const i of input.split(' ')) {
        const kanjiData = kanjiDB.filter(k=>{
          if (k.meaning.includes(i)) return true
          if (k.onyomi.replaceAll(/[\(\)]/g,'').includes(i)) return true
          if (k.kunyomi.replaceAll(/[\(\)]/g,'').includes(i)) return true
        })
        kanjiData.forEach(k=>{
          if (addedKanjis.includes(k.character)) return
          addedKanjis.push(k.character)
          results.push(k)
        })
      }
      return results
    },
    kanjiDB: async () => {
      const cacheKey = 'bba_ja_kanjidb'
      if (cache[cacheKey]) return cache[cacheKey]
      const response = await getHttps('https://github.com/aidulcandra/materi-bahasa-asing/raw/main/ja/other/kanji/kanji.json')
      cache[cacheKey] = JSON.parse(response.data)
      return cache[cacheKey]
    }
  },
  espanol: {
    dictionaryData: async () => {
      const cacheKey = 'bba_es_dictionary'
      if (cache[cacheKey]) return cache[cacheKey]
      const response = await getHttps('https://github.com/aidulcandra/materi-bahasa-asing/raw/main/es/other/stml_es_id.json')
      cache[cacheKey] = JSON.parse(response.data)
      return cache[cacheKey]
    },
    dictionary: async (keyword) => {
      const dd = await bba.espanol.dictionaryData()
      const result = dd.filter(i=>i.esp.includes(keyword) || i.ind.includes(keyword))
      return result
    }
  }
}

const weblioIndo = {
  jaidDict: async (keyword) => {
    const page = await getHttps(`https://njjn.weblio.jp/content/${keyword}`)
    const doc = new JSDOM(page.data).window.document
    const items = Array.from(doc.querySelectorAll('.midashigo, .Igngj, .Inghj'))
    const result = []
    for (;items.length;) {
      result.push({
        word: items.shift().textContent.replaceAll('\n',''),
        meaning: items.shift().textContent.replaceAll('\n',''),
      })
    }
    return result
  }
}

const jot = {
  deidDict: async (keyword) => {
    const page = await getHttp(`http://www.jot.de/kamus/kj.cgi?wort=${keyword}&suchtyp=standard&vrs=20082`)
    const doc = new JSDOM(page.data).window.document
    const items = Array.from(doc.querySelectorAll('.linkespalte, .rechtespalte'))
    const result = []
    for (;items.length;) {
      result.push({
        word: items.shift().textContent,
        meaning: items.shift().textContent,
      })
    }
    return result
  }
}

const tatoeba = {
  search: async (query, lang) => {
    const response = await getHttps(`https://tatoeba.org/eng/api_v0/search/?from=${lang}&orphans=no&query=${query}&sort=random&trans_filter=limit&unapproved=no`)
    const list = JSON.parse(response.data)
    return list.results
  }
}

const happi = {
  lyricsSearch: async (keyword) => {
    const key = 'happi_ls_'+keyword
    if (cache[key]) return cache[key]
    const response = await getHttps(
      `https://api.happi.dev/v1/music?q=${keyword}&lyrics=true&limit=10`, 
      {headers:{'x-happi-key':process.env.HAPPI_KEY}}
    )
    const result = JSON.parse(response.data)
    cache[key] = result.result
    return cache[key]
  },
  lyrics: async (link) => {
    const key = 'happi_l_' + link
    if (cache[key]) return cache[key]
    const response = await getHttps(
      link, {headers:{'x-happi-key':process.env.HAPPI_KEY}}
    )
    const result = JSON.parse(response.data)
    const {artist, album, track, lyrics} = result.result
    cache[key] = {artist, album, track, lyrics}
    return cache[key]
  }
}

const youtube = {
  search: async (keyword) => {
    const key = 'yt_s_'+keyword
    if (cache[key]) return cache[key]
    const page = await getHttps('https://www.youtube.com/results?search_query='+keyword)
    const titles = page.data.match(/(?<=ytInitialData = )[\S\s]+?\}(?=;)/g)
    const results = JSON.parse(titles).contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(c=>c.hasOwnProperty('videoRenderer'))
      .map(r => ({id:r.videoRenderer.videoId, title:r.videoRenderer.title.runs[0].text}) )
    cache[key] = results
    return results
  }
}

const vevioz = {
  /** Type: 'mp3' or 'videos' */
  getLink: async (type, id) => {
    const page = await getHttps(
      `https://api.vevioz.com/api/button/${type}/${id}`,
      {log:true}
    )
    const doc = new JSDOM(page.data).window.document
    const link = doc.querySelector('.download > a:nth-child(4)').getAttribute('href')
    return link
  }
}

module.exports = {
  roboHash, openDrive, cambridgeDictionary, freeDictionary, ozdic, soundOfText,
  randomWord, fisenko, forismatic, jokeApi, iCanHazDadJoke, uselessFacts, asliFunFact,
  adviceSlip, googleTranslate, bba, weblioIndo, jot, tatoeba, happi, youtube, vevioz
}
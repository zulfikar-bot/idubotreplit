const {randomInt} = require('crypto')
const bot = require('./system/bot')
const database = require('./system/replit-db')
const bba = require('./extra/bba')
const tools = require('./extra/tools')
const api = require('./extra/apis')

let prefix = ''
const cache = {}

const list = [

  {
    name: 'ping', info: 'Tes respon bot',
    run: ({ message }) => message.reply(tools.choose('Pong', 'Hadir', 'Aktif', 'Siap'))
  },

  //===========================================================================
  { section: 'Belajar Bahasa Asing' },
  {
    name: 'reg', info: 'Daftarkan grup untuk materi bahasa asing', groupOnly: true,
    run: ({ parameters, message }) => {
      const [code] = parameters
      if (!code) {
        const instructions =
          bba.getLanguages().map(l => `${prefix}reg ${l.code} (${l.name})`).join('\n')
        return message.reply(`Sertakan kode bahasa.\n` + instructions)
      } if (!bba.codeExists(code)) {
        const codeList =
          bba.getLanguages().map(l => `· ${l.code} (${l.name})`).join('\n')
        return message.reply(`Kode bahasa *${code}* tidak dikenali. Kode yang tersedia:\n` + codeList)
      }
      bba.registerRoom(message.room, code)
      message.reply('✅ Grup ini telah terdaftar materi: ' + bba.getLanguageName(code))
    }
  },
  {
    name: 'unreg', info: 'Batalkan mendaftarkan grup untuk materi bahasa asing',
    groupOnly: true, run: async ({ parameters, message }) => {
      if (!bba.isRegistered(message.room)) return message.reply('Grup ini sedang tidak terdaftar pada materi bahasa asing')
      const [code] = parameters
      if (!code) {
        const instructions =
          bba.getRoomCodes(message.room).map(l => `${prefix}unreg ${l}`).join('\n')
        return message.reply(`Sertakan kode bahasa.\n` + instructions)
      } if (!bba.codeExists(code)) {
        const codeList =
          bba.getLanguages().map(l => `· ${l.code} (${l.name})`).join('\n')
        return message.reply(`Kode bahasa *${code}* tidak dikenali. Kode yang tersedia:\n` + codeList)
      }
      bba.unregisterRoom(message.room, code)
      message.reply('✅ Grup ini telah berhenti mendaftar materi: ' + bba.getLanguageName(code))
    }
  },
  {
    name: 'materi', info: 'Materi bahasa asing', tag: 'bba',
    run: async ({ parameters, message, group }) => {
      const { code, newParams } = getCodeParameters('materi', parameters, message, group, ['', '1'])
      if (!code) return
      const [id] = newParams
      if (!id) return message.reply(await bba.getRandomMaterial(code))
      if (isNaN(id)) {
        const roomCodes = bba.getRoomCodes(message.room)
        const instructions = roomCodes.length > 1
          ? roomCodes.map(c => `${prefix}materi ${c} 1`).join('\n')
          : `${prefix}materi 1`
        return message.reply(`Gunakan perintah diikuti angka untuk memilih materi:\n${instructions}`)
      } else {
        const material = await bba.getMaterial(code, id - 1)
        if (!material) return message.reply(`Materi ${bba.getLanguageName(code)} nomor ${id} tidak ditemukan`)
        message.reply(material)
      }
    }
  },
  {
    name: 'list', info: 'List materi bahasa asing', tag: 'bba',
    run: async ({ parameters, message, group }) => {
      const { code } = getCodeParameters('list', parameters, message, group)
      if (!code) return
      const list = await bba.getMaterialList(code)
      const roomCodes = group ? bba.getRoomCodes(message.room) : bba.getAllCodes()
      const instructions = (roomCodes.length > 1)
        ? `${prefix}materi ${code} 1`
        : `${prefix}materi 1`
      const listText =
        '*📜 List Materi:* ' + bba.getLanguageName(code) + '\n' +
        list.map((m, i) => `${i + 1}) ${m.title}`).join('\n') +
        '\n\nUntuk memilih materi, gunakan perintah materi disertai angka:\n' +
        instructions
      message.reply(listText)
    }
  },
  {
    name: 'cari', info: 'Cari materi bahasa asing', tag: 'bba',
    run: async ({ parameters, message, group }) => {
      const { code, newParams } = getCodeParameters('cari', parameters, message, group, ['tata bahasa'])
      if (!code) return
      const keywords = newParams
      if (!keywords.length) return message.reply(`Sertakan dengan kata kunci`)
      const searchResult = await bba.searchMaterial(code, keywords)
      if (!searchResult.length) return message.reply('Materi tidak ditemukan')
      const roomCodes = group ? bba.getRoomCodes(message.room) : bba.getAllCodes()
      const instructions = (roomCodes.length > 1)
        ? `${prefix}materi ${code} 1`
        : `${prefix}materi 1`
      const listText =
        '*🔍 Hasil Pencarian Materi:* ' + bba.getLanguageName(code) + '\n' +
        searchResult.map((m) => `${m.index + 1}) ${m.title}`).join('\n') +
        '\n\nUntuk memilih materi, gunakan perintah materi disertai angka:\n' +
        instructions
      message.reply(listText)
    }
  },
  {
    name: 'doc', info: 'Dokumen pembelajaran bahasa asing', tag: 'bba',
    run: async ({ parameters, message, group }) => {
      const { code } = getCodeParameters('doc', parameters, message, group)
      if (!code) return
      const username = process.env.OD_USER
      const password = process.env.OD_PASS
      const folderIds = {
        en: process.env.OD_EN_FOLDERID,
        ja: process.env.OD_JA_FOLDERID,
        de: process.env.OD_DE_FOLDERID,
        es: process.env.OD_ES_FOLDERID,
      }
      const session = await api.openDrive.login(username, password)
      const list = await api.openDrive.listFolder(session, folderIds[code])
      const formatSize = (i) => {
        const input = parseInt(i)
        if (input > 999999) { return Number(input / 1000000).toFixed(1) + ' MB' }
        if (input > 999) { return Number(input / 1000).toFixed(1) + ' KB' }
        return input + 'B'
      }
      const title = "*📚 Dokumen Pembelajaran:* " + bba.getLanguageName(code)
      const text = "Klik tombol di bawah untuk membuka daftar dokumen"
      const buttonText = "LIST DOKUMEN"
      const sections = [{ rows: [] }]
      list.forEach((i, p) => {
        sections[0].rows.push({
          title: i.Name, description: formatSize(i.Size), rowId: `doc ${i.DownloadLink}`
        })
      })
      bot.sendList(message.room, title, text, null, buttonText, sections)
    }
  },

  //===========================================================================
  { section: 'Belajar English', bbaCode: 'en' },
  {
    name:'rr', info:'Teks Read & Record Acak', bbaCode:'en',
    run:async({message})=>{
      const text = await api.bba.english.readRecord()
      message.reply(text)
    }
  },
  {
    name:'tt', info:'Teks Tongue Twister Acak', bbaCode:'en',
    run:async({message})=>{
      const text = await api.bba.english.tongueTwister()
      message.reply('😝 *Tongue Twister*\n' + text)
    }
  },
  {
    name: 'def', info: 'Kamus Inggris-Inggris', bbaCode: 'en',
    run: async ({ parameters, message }) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(`Sertakan dengan kata yang akan dicari.\nContoh: ${prefix}def study`)
      const result = await api.freeDictionary.getDefinition(keyword)
      if (!result.length) return message.reply(`Kata tidak ditemukan`)
      const resultText =
        result.map(r => {
          return `📖 *${r.word}* ${r.phonetic || ''}\n` +
            r.meanings.map(m => {
              return `[${m.partOfSpeech}]\n` +
                m.definitions.map((d, i) => {
                  return `${i + 1}) ${d.definition}` +
                    (d.example ? `\n*Ex:* ${d.example}` : '')
                }).join('\n') +
                (m.synonyms.length ? `\n*Synonyms:* _${m.synonyms.join(', ')}_` : '') +
                (m.antonyms.length ? `\n*Antonyms:* _${m.antonyms.join(', ')}_` : '')
            }).join('\n')
        }).join('\n\n')
      message.reply(resultText)
    }
  },
  {
    name: 'dic', info: 'Kamus Inggris ↔ Indo', bbaCode: 'en',
    run: async ({ parameters, message }) => {
      const instructions =
        `*Penggunaan Kamus:*\n`+
        `${prefix}dic [arah_kamus] [kata_yang_dicari]\n\n` +
        `*Arah Kamus:*\n`+
        `· ei ➭ English to Indonesian\n`+
        `· ie ➭ Indonesian to English\n\n`+
        `*Contoh:* ${prefix}dic ei book`
      const dir = parameters[0]
      const keyword = parameters.slice(1).join(' ')
      if (!dir || !['ei','ie'].includes(dir)) return message.reply(instructions)
      if (!keyword) return message.reply(instructions)
      const result = await api.cambridgeDictionary.enid(keyword, dir)
      if (!result.length) return message.reply('Kata tersebut tidak ditemukan')
      let resultText =
        `📘 *Kamus ${dir==='ei'?'Inggris→Indonesia':'Indonesia→Inggris'}:* ${keyword}\n\n` +
        result.map(r=>{
          return `*${r.word}* [${r.pos}]${r.pron?' '+r.pron:''}\n` +
          r.senses.map(s=>{
            return `· ${s.trans}${s.def?' ('+s.def+')':''}${!s.ex.length?'':'\n  Ex:\n'+s.ex.map(e=>`  _${e}_`).join('\n')}`
          }).join('\n')
        }).join('\n\n')
      message.reply(resultText)
    }
  },
  {
    name: 'clc', info: 'Kamus collocation bhs. Inggris', bbaCode: 'en',
    run: async ({ parameters, message }) => {
      const input = parameters.join(' ')
      if (!input) return message.reply(`Sertakan dengan kata yang ingin dicari.\nContoh: ${prefix}clc look`)
      const result = await api.ozdic.collocation(input)
      if (!result.length) return message.reply('Kata tersebut tidak ditemukan')
      const resultText =
        `📖 *Kamus Collocation:* ${input}\n\n` +
        result.map(i => {
          let rowsText = ''
          i.rows.forEach(r => {
            switch (Object.keys(r)[0]) {
              case 'SUP': {
                rowsText += r.SUP + ') '; break
              } case 'TT': {
                rowsText += `\`\`\`${r.TT}\`\`\`\n`; break
              } case 'U': {
                rowsText += `[${r.U}]\n`; break
              } case 'B': {
                rowsText += `*${r.B}*\n`; break
              } case 'I': {
                rowsText += `_${r.I}_\n`; break
              }
            }
          })
          return `⬤ *${i.word}* _${i.pos}_\n` + rowsText
        }).join('\n')
      message.reply(resultText)
    }
  },
  {
    name: 'read', info: 'Lafalkan teks bahasa Inggris', bbaCode: 'en',
    run: async ({ parameters, message }) => {
      const accentCodes = {
        am: ['en-US', 'American'],
        br: ['en-GB', 'British'],
        au: ['en-AU', 'Australian']
      }
      const instructions =
        Object.keys(accentCodes)
          .map(c => `${prefix}read ${c} Good morning   (${accentCodes[c][1]})`).join('\n')
      const accent = parameters[0]
      if (!accent || !Object.keys(accentCodes).includes(accent))
        return message.reply(`Sertakan kode aksen. Contoh:\n${instructions}`)
      let text = parameters.slice(1).join(' ') || message.quoted?.text
      if (!text) return message.reply(
        `Sertakan dengan teks yang akan dibacakan. Contoh:\n` +
        instructions +
        `\n\nAtau gunakan perintah sambil me-reply pesan yang berisi teks.`
      )
      if (text.length >= 200) return message.reply('Teks terlalu panjang')
      const url = await api.soundOfText.tts(text, accentCodes[accent][0])
      if (!url) return message.reply(`🙈 Terjadi error ketika menghubungi server`)
      bot.sendAudio(message.room, url, 'audio/mp4', message.getMessageInfo())
    }
  },
  {
    name: 'rid', info: 'Random idiom', bbaCode: 'en',
    run: async ({message}) => {
      const { idiom, meaning } = await api.randomWord.idiom()
      message.reply(`*📝 Random Idiom:*\n${idiom}\n\n*Meaning:*\n${meaning}`)
    }
  },
  {
    name: 'quote', info: 'Random quote', bbaCode: 'en',
    run: async ({message}) => {
      const sources = [
        api.forismatic.quote,
        //api.fisenko.quote,
      ]
      const { quote, author } = await sources[randomInt(sources.length)]()
      message.reply(`🌙 *Random Quote*\n_${quote}_\n- ${author || 'Anonymous'} -`.replace(/ +_/, '_'))
    }
  },
  {
    name: 'joke', info: 'Random joke', bbaCode: 'en',
    run: async ({message}) => {
      const sources = [
        api.jokeApi.joke,
        api.iCanHazDadJoke.joke,
      ]
      const joke = await sources[randomInt(sources.length)]()
      message.reply(`🤡 *Random Joke*\n` + joke)
    }
  },
  {
    name: 'fact', info: 'Random fact', bbaCode: 'en',
    run: async ({message}) => {
      const sources = [
        api.uselessFacts.fact,
        api.asliFunFact.fact,
      ]
      const fact = await sources[randomInt(sources.length)]()
      message.reply(`🗿 *Random Fact*\n` + fact)
    }
  },
  {
    name: 'advice', info: 'Random advice', bbaCode: 'en',
    run: async ({message}) => {
      const advice = await api.adviceSlip.advice()
      message.reply(`🎁 *Random Advice*\n` + advice)
    }
  },

  //===========================================================================
  { section:'Belajar Nihon-go', bbaCode:'ja' },
  {
    name:'kanji', info:'Detail tentang kanji', bbaCode:'ja',
    run:async({parameters, message}) => {
      const input = parameters.join(' ')
      if (!input.length) return message.reply(
        'Sertakan dengan kanji / bacaan kunyomi dalam hiragana / bacaan onyomi dalam katakana / makna dari kanji. Contoh:\n' +
        `${prefix}kanji 水\n` +
        `${prefix}kanji みず\n` +
        `${prefix}kanji スイ\n` +
        `${prefix}kanji air`
      )
      const result = await api.bba.japanese.kanji(input)
      if (!result.length) return message.reply(`Kanji tidak ditemukan di dalam database`)
      const resultText =
        `🈷 *Kamus Kanji:*\n\n`+
        result.map(r=>{
          return `${r.character}\n` +
          `· Kunyomi: ${r.kunyomi}\n` +
          `· Onyomi: ${r.onyomi}\n` +
          `· Arti: ${r.meaning}`
        }).join('\n\n')
      message.reply(resultText)
    }
  },
  {
    name:'yomu', info:'Lafalkan teks bahasa Jepang', bbaCode:'ja',
    run: async ({ parameters, message }) => {
      let text = parameters.join(' ') || message.quoted?.text
      if (!text) return message.reply(
        `Sertakan dengan teks yang akan dibacakan. Contoh:\n` +
        `${prefix}yomu こんにちは` +
        `\n\nAtau gunakan perintah sambil me-reply pesan yang berisi teks.`
      )
      if (text.length >= 200) return message.reply('Teks terlalu panjang')
      const url = await api.soundOfText.tts(text, 'ja-JP')
      if (!url) return message.reply(`🙈 Terjadi error ketika menghubungi server`)
      bot.sendAudio(message.room, url, 'audio/mp4', message.getMessageInfo())
    }
  },
  {
    name:'jisho', info:'Kamus Jepang-Indo', bbaCode:'ja',
    run: async ({ parameters, message }) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(`Sertakan dengan kata kunci.\nContoh: ${prefix}jisho belajar`)
      const result = await api.weblioIndo.jaidDict(keyword)
      if (!result.length) return message.reply('Kata tersebut tidak ditemukan')
      const resultText =
        `📕 *Kamus Jepang-Indo*:\n` +
        result.map(r=>`${r.word} : ${r.meaning}`).join('\n')
      message.reply(resultText)
    }
  },

  //==========================================================================
  { section: 'Belajar Deutsch', bbaCode:'de' },
  {
    name:'wb', info:'Kamus Jerman-Indo', bbaCode:'de',
    run: async ({parameters, message}) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(`Sertakan dengan kata kunci.\nContoh: ${prefix}wb belajar`)
      const result = await api.jot.deidDict(keyword)
      if (!result.length) return message.reply('Kata tersebut tidak ditemukan')
      const resultText = 
        `📙 *Kamus Jerman-Indo*:\n` +
        result.map(r=>`${r.word} : ${r.meaning}`).join('\n')
      message.reply(resultText)
    }
  },
  {
    name:'vorl', info:'Lafalkan teks bahasa Jerman', bbaCode:'de',
    run: async ({ parameters, message }) => {
      let text = parameters.join(' ') || message.quoted?.text
      if (!text) return message.reply(
        `Sertakan dengan teks yang akan dibacakan. Contoh:\n` +
        `${prefix}vorl Guten Morgen` +
        `\n\nAtau gunakan perintah sambil me-reply pesan yang berisi teks.`
      )
      if (text.length >= 200) return message.reply('Teks terlalu panjang')
      const url = await api.soundOfText.tts(text, 'de-DE')
      if (!url) return message.reply(`🙈 Terjadi error ketika menghubungi server`)
      bot.sendAudio(message.room, url, 'audio/mp4', message.getMessageInfo())
    }
  },

  //==========================================================================
  { section:'Belajar Español', bbaCode:'es'},
  {
    name:'dicc', info:'Kamus Spanyol-Indo', bbaCode:'es',
    run: async ({parameters, message}) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(`Sertakan dengan kata kunci.\nContoh: ${prefix}dicc belajar`)
      const result = await api.bba.espanol.dictionary(keyword)
      if (!result.length) return message.reply('Kata tersebut tidak ditemukan')
      const resultText = 
        `📗 *Kamus Spanyol-Indo*:\n` +
        result.map(r=>`${r.esp} : ${r.ind}`).join('\n')
      message.reply(resultText)
    }
  },
  {
    name: 'leer', info: 'Lafalkan teks bahasa Spanyol', bbaCode: 'es',
    run: async ({ parameters, message }) => {
      const accentCodes = {
        sp: ['es-ES', 'Spanish'],
        mx: ['es-MX', 'Mexican'],
      }
      const instructions =
        Object.keys(accentCodes)
          .map(c => `${prefix}leer ${c} Buenos días   (${accentCodes[c][1]})`).join('\n')
      const accent = parameters[0]
      if (!accent || !Object.keys(accentCodes).includes(accent))
        return message.reply(`Sertakan kode aksen. Contoh:\n${instructions}`)
      let text = parameters.slice(1).join(' ') || message.quoted?.text
      if (!text) return message.reply(
        `Sertakan dengan teks yang akan dibacakan. Contoh:\n` +
        instructions +
        `\n\nAtau gunakan perintah sambil me-reply pesan yang berisi teks.`
      )
      if (text.length >= 200) return message.reply('Teks terlalu panjang')
      const url = await api.soundOfText.tts(text, accentCodes[accent][0])
      if (!url) return message.reply(`🙈 Terjadi error ketika menghubungi server`)
      bot.sendAudio(message.room, url, 'audio/mp4', message.getMessageInfo())
    }
  },

  //==========================================================================
  { section: 'Alat' },
  { 
    name:'gt', info:'Google Translate',
    run:async({parameters,message}) => {
      const [from, to] = parameters
      const text = parameters.slice(2).join(' ')
      const instructions = 
        '*Cara penggunaan:*\n'+
        `➊ Langsung:\n${prefix}gt [bhs_asal] [bhs_target] [teks]\n`+
        `Contoh: ${prefix}gt en id Good morning\n\n`+
        `➋ Translate pesan lain (reply/tag ke pesan tersebut):\n`+
        `${prefix}gt [bhs_asal] [bhs_target]\n`
      if (!(from&&to)) return message.reply(instructions)
      const input = text || message.quoted?.text
      if (!input) return message.reply( instructions)
      const langs = api.googleTranslate.languages
      if (!langs.find(l=>l.code===from))
        return message.reply(
          `Kode bahasa *${from}* tidak dikenali. Ketik ${prefix}kodegt untuk melihat kode bahasa yang ada.`
        )
      if (!langs.find(l=>l.code===to)) {
        return message.reply(
          `Kode bahasa *${ke}* tidak dikenali. Ketik ${prefix}kodegt untuk melihat kode bahasa yang ada.`
        )
      }
      if (input.length >= 5000) return message.reply('Teks terlalu panjang')
      const pleaseWaitTimer = setTimeout(
        ()=>message.reply(`Mohon tunggu sejenak, server penerjemah sedang disiapkan`),
        10*1000
      )
      const result = await api.googleTranslate.translate(from, to, input)
      clearTimeout(pleaseWaitTimer)
      message.reply(
        '🔠 *Google Translate*\n'+
        `${langs.find(l=>l.code===from).name} ➜ ${langs.find(l=>l.code===to).name}\n`+
        result.translation+
        (result.translit ? `\n[${result.translit}]`:'')
      )
    }
  },
  {
    name:'kodegt', info:'Kode Bahasa Google Translate',
    run:async({message}) => {
      const langs = api.googleTranslate.languages
      message.reply(
        `🔠 *Kode Bahasa Google Translate*:\n`+
        langs.map(l=>`${l.code} : ${l.name}`).join('\n')
      )
    }
  },
  {
    name:'kalimat', info:'Contoh kalimat acak', 
    run:async({parameters, message}) => {
      const languages = {
        'en' : ['eng', 'Bahasa Inggris'],
        'ja' : ['jpn', 'Bahasa Jepang'],
        'de' : ['deu', 'Bahasa Jerman'],
        'es' : ['spa', 'Bahasa Spanyol'],
        'ar' : ['ara', 'Bahasa Arab'],
        'ma' : ['cmn', 'Bahasa Mandarin'],
        'ko' : ['kor', 'Bahasa Korea'],
      }
      const [lang] = parameters
      const query = parameters.slice(1).join(' ')
      if (!lang || !languages[lang]) return message.reply(
        `Sertakan kode bahasa:\n` +
        Object.keys(languages).map(l => `✯ ${l} (${languages[l][1]})`).join('\n') +
        `\n\nContoh:\n${prefix}kalimat en apple (Untuk mencari kalimat berisi kata)\n` +
        `${prefix}kalimat en       (Untuk kalimat acak)`
      )
      const noBound = ['ja', 'ma'].includes(lang)
      const finalQuery = (query&&noBound) ? `"${query}"` : query
      const results = await api.tatoeba.search(finalQuery, languages[lang][0])
      if (!results.length) return message.reply('Kalimat tidak ditemukan')
      const resultText =
        `🗣 *Contoh Kalimat ${languages[lang][1]}*\n` +
        (query ? `Kata Kunci: ${query}\n` : '') +
        results.map((r) => `⋆ ${r.text}`).join('\n')
      message.reply(resultText)
    }
  },
  {
    name:'lirik', info:'Cari lirik lagu',
    run:async({parameters,message}) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(
        `Sertakan dengan kata kunci.\n`+
        `Contoh: ${prefix}lirik linkin park numb\n\n`+
        `Tips: Agar lebih akurat tuliskan judul lagu berserta penyanyi/band nya (seperti pada contoh).`
      )
      const list = await api.happi.lyricsSearch(keyword)
      if (!list.length) return message.reply('Lirik tidak ditemukan')
      const title = '🎤 *Hasil Pencarian Lirik:*'
      const text = 'Klik tombol di bawah untuk melihat hasil pencarian'
      const buttonText = 'Lirik'
      const sections = [{ rows: [] }]
      list.forEach((i, p) => {
        sections[0].rows.push({
          title: i.track, description: i.artist, rowId: `lirik ${i.api_lyrics}`
        })
      })
      bot.sendList(message.room, title, text, null, buttonText, sections, message.getMessageInfo())
    }
  },
  {name:'imread', info:'Ambil teks dari gambar', dev:true},
  {name:'tc', info:'Transkrip audio', dev:true},
  {
    name:'rng', info:'Angka acak',
    run:({parameters,message})=>{
      const [number] = parameters
      const instructions = `Sertakan dengan angka (bulat, positif, max. 999999)\nContoh: ${prefix}rng 6`
      const n = parseInt(number)
      if (!Number.isInteger(n)) return message.reply(instructions)
      if (n < 0) return message.reply(instructions)
      if (n > 999999) return message.reply(instructions)
      message.reply(`🎲 *Angka Acak* (0-${n})\nHasil: ${randomInt(n+1)}`)
    }
  },
  {
    name:'stiker', info:'Buat stiker dari gambar/GIF',
    run:async({parameters, message})=>{
      const types = ['image', 'gif']
      const instructions = 
        `*Cara Membuat Stiker Dengan Bot*\n\n` +
        `Format perintah:\n` +
        `${prefix}stiker "nama pack" "nama author"\n\n` +
        `Contoh:\n` +
        `${prefix}stiker "Stiker lucu" "Idul Candra"\n` +
        `(Perhatikan tanda petik dan spasinya)\n\n` +
        `Catatan: Nama pack dan author tidak wajib, jika tidak disediakan maka otomatis menggunakan nama "IduBot"\n\n` +
        `Gunakan perintah sebagai caption dari gambar/GIF. ` +
        `Atau gunakan perintah sambil me-reply pesan berisi gambar/GIF.`
      const newParameters = parameters.join(' ').match(/(?<=").+?(?=")/g)
      const pack = newParameters?.[0] || 'IduBot'
      const author = newParameters?.[2] || 'IduBot'
      let buffer
      if (types.includes(message.type)) {
        buffer = await message.getMediaBuffer()
      } else if (types.includes(message.quoted.type)) {
        const mInfo = await getSavedMedia(message.quoted.id)
        if (!mInfo) return message.reply(`Gambar tersebut sudah tidak tersimpan di dalam memori bot. Silakan dikirim ulang.`)
        buffer = await bot.getMediaBuffer(mInfo)
      } else return message.reply(instructions)
      bot.sendSticker(message.room, {buffer, pack, author}, message.getMessageInfo())
    }
  },
  {
    name:'yt', info:'Cari video YouTube',
    run:async({parameters, message}) => {
      const keyword = parameters.join(' ')
      if (!keyword) return message.reply(`Sertakan dengan kata kunci pencarian. Contoh:\n${prefix}yt linkin park numb`)
      const result = await api.youtube.search(keyword)
      const title = '▶ *Hasil Pencarian Youtube:*'
      const text = 'Klik tombol di bawah untuk melihat hasil pencarian'
      const footer = '*Tips:* Jika mendownload musik, kebanyakan video/audio yang official tidak dapat didownload.'
      const buttonText = 'Hasil Pencarian'
      const sections = []
      result.forEach((i, p) => {
        const section = { 
          title: i.title, 
          rows: [
            { title: '[Audio] '+i.title.slice(0,10)+'...', rowId: `yt a ${i.id}` },
            { title: '[Video] '+i.title.slice(0,10)+'...', rowId: `yt v ${i.id}` },
          ] 
        }
        sections.push(section)
      })
      bot.sendList(message.room, title, text, footer, buttonText, sections, message.getMessageInfo())
    }
  },


  //===========================================================================
  { 
    name: 'eval', ownerOnly: true,
    run: ({parameters, message, sender, group}) => {
      const script = parameters.join(' ')
      const value = eval(script)
      message.reply(value.toString())
    }
  },
  {
    name:'exec', ownerOnly:true,
    run: async ({parameters, message, sender, group}) => {
      const script = `(async()=>{${parameters.join(' ')}})()`
      await eval(script)
    }
  }

]

// ===========================================================
// ===========================================================
const listResponseList = [
  {
    name: 'doc', run: async ({ parameters, message, sender, group }) => {
      const [link] = parameters
      const alreadySent = cache['doc_' + link]
      if (alreadySent) {
        const senderNumber = sender.id.replace(/[^0-9]/g, '')
        if (alreadySent.room !== message.room) {
          const sent = await alreadySent.forward(message.room)
          return sent.reply(`@${senderNumber}`, [sender.id])
        }
        return alreadySent.reply(
          `File sudah dikirimkan di sini @${senderNumber}`, [sender.id]
        )
      }
      bot.sendText(message.room, 'Mengirim file...')
      const sent = await bot.sendDocument(message.room, link, message.text, 'application/pdf', message.getMessageInfo())
      cache['doc_' + link] = sent
    }
  },
  {
    name: 'lirik', run: async ({ parameters, message, sender, group }) => {
      const [link] = parameters
      const result = await api.happi.lyrics(link)
      const formatted =
        `🎶 *Song:* ${result.track || 'Untitled'}\n` +
        `👨‍🎤 *Artist:* ${result.artist || 'Unknown'}\n` +
        `💽 *Album:* ${result.album || 'Unknown'}\n` +
        `🎤 *Lyrics:*\n${result.lyrics}`
      
      message.reply(formatted)
    }
  },
  {
    name: 'yt', run: async ({ parameters, message, sender, group }) => {
      const [type, id] = parameters
      const keyName = 'yt_' + type + '_' + id
      const alreadySent = cache[keyName]
      if (alreadySent) {
        const senderNumber = sender.id.replace(/[^0-9]/g, '')
        if (alreadySent.room !== message.room) {
          const sent = await alreadySent.forward(message.room)
          return sent.reply(`@${senderNumber}`, [sender.id])
        }
        return alreadySent.reply(
          `Media sudah dikirimkan di sini @${senderNumber}`, [sender.id]
        )
      }
      bot.sendText(message.room, 'Mengirim media...')
      const downloadType = {a:'mp3', v:'videos'}
      const link = await api.vevioz.getLink(downloadType[type], id)
      let sent
      if (type==='a') {
        sent = await bot.sendAudio(message.room, link, 'audio/mp4', message.getMessageInfo())
      } else {
        sent = await bot.sendVideo(message.room, link, message.getMessageInfo())
      }
      cache[keyName] = sent
    }
  },
]

function setPrefix(newPrefix) {
  prefix = newPrefix
}

function sendMenu(message, groupId) {
  const itemList = list.filter(c => {
    if (c.ownerOnly) return false
    if (c.tag === 'bba' && groupId && !bba.isRegistered(groupId)) return false
    if (c.bbaCode) {
      const roomCodes = groupId ? bba.getRoomCodes(groupId) : bba.getAllCodes()
      if (!roomCodes.includes(c.bbaCode)) return false
    }
    return true
  }).map(c => {
    if (c.section) return `\n*[${c.section}]*`
    return `${c.dev?'🛠 ':''}${prefix}${c.name} ➛ ${c.info}`
  }).join('\n')

  const menuText =
    '*MENU IDUBOT*\n' +
    '===================\n' +
    itemList +
    `\n\n 📱 Kontak owner: +${bot.getOwnerNumber()} (Idul)`
  return message.reply(menuText)
}

function getCodeParameters(commandName, parameters, message, group, exampleParams = ['']) {
  const roomCodes = group ? bba.getRoomCodes(message.room) : bba.getAllCodes()
  const roomLanguages = group ? bba.getRoomLanguages(message.room) : bba.getLanguages()
  if (roomCodes.length === 0) {
    message.reply(`Grup ini belum terdaftar materi bahasa asing. Untuk admin silakan gunakan perintah ${prefix}reg`)
    return {}
  } else if (roomCodes.length === 1) {
    return { code: roomCodes[0], newParams: parameters }
  } else {
    const code = parameters[0]
    if (!code || !bba.codeExists(code)) {
      const groupCodeList =
        roomLanguages.map(l => {
          return exampleParams.map(e => `${prefix}${commandName} ${l.code} ${e}`).join('\n')
        }).join('\n')
      message.reply(`Kode bahasa tidak terdeteksi. Contoh perintah yang dapat dilakukan:\n${groupCodeList}`)
      return {}
    } return { code, newParams: parameters.slice(1) || [] }
  }
}

async function getSavedMedia(keyId) {
  const keys = await database.list('media_')
  const key = keys.find(k=>{
    const [_,id] = k.split('_')
    if (id === keyId) return true
  })
  return await database.get(key)
}

module.exports = { list, listResponseList, sendMenu, setPrefix }
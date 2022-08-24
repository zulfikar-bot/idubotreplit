const http = require('http')
const {randomInt} = require('crypto')
const bot = require('./system/bot')
const database = require('./system/replit-db')
const api = require('./extra/apis')
const commandHandler = require('./command-handler')

const {BOT_NUMBER, OWNER_NUMBER} = process.env

const PREFIX = '!'

http.createServer((req, res) => {
  res.end('Bot server is online')
  console.log('Received ping', req.connection.remoteAddress)
}).listen(3000)

commandHandler.setPrefix(PREFIX)
bot.setNumber(BOT_NUMBER)
bot.setOwner(OWNER_NUMBER)
bot.start({
  on_ready: async () => {
    const url = api.roboHash.makeUrl(Date.now().toString(), randomInt(4)+1)
    try {await bot.updateProfilePicture(url)} catch {}
    setInterval(()=>deleteExpiredMedia(3600), 60000)
  },
  
  on_message: async (message, sender, group) => {
    const {type, text} = message
    const senderName = sender.name || sender.id
    const groupName = group ? ` (${group.name})` : ''

    // Log commands to console
    console.log(`${type} from ${senderName}${groupName}: ${text}`)
    if (!type) console.log(Object.keys(message.getMessageInfo().message))

    // Save media messages
    const savedMediaTypes = ['image', 'video', 'gif', 'audio', 'vn']
    if (savedMediaTypes.includes(type)) saveMedia(message.getMessageInfo())

    // Extract command
    if (!(text.startsWith(PREFIX) && text.length > 1)) return
    const payload = text.split(' ')
    const commandName = payload[0].slice(1)
    const parameters = payload.slice(1)

    if (!commandName) return message.reply(`Mohon perhatikan penulisan perintah yang benar.\nContoh: ${PREFIX}menu`)

    // Menu
    if (commandName === 'menu') {commandHandler.sendMenu(message, group?.id); return}

    // Other commands
    const commandItem = commandHandler.list.find(c=>c.name===commandName)
    if (!commandItem) return message.reply(`Perintah tersebut tidak ditemukan. Ketik ${PREFIX}menu untuk melihat daftar perintah yang tersedia.`)
    if (commandItem.ownerOnly && !sender.isOwner) return message.reply(`Perintah tersebut khusus owner bot`)
    if (commandItem.adminOnly && !(sender.isAdmin || sender.isOwner)) return message.reply(`Perintah tersebut khusus admin grup dan owner bot`)
    if (commandItem.groupOnly && !group) return message.reply('Perintah tersebut khusus di dalam grup')
    if (commandItem.dev && !sender.isOwner) return message.reply(`Fitur tersebut sementara dikembangkan.`)
    try {await commandItem.run({parameters, message, sender, group})}
    catch (e) {
      message.reply(e.toString())
      const errorReport =
        `*Error Report*\n` +
        `Event: On Message\n` +
        `Room: ${group?.name || sender.id}\n` +
        `Details:\n${e.message}\n${e.stack}`
      bot.sendText(bot.getOwnerId(), errorReport)
    }
  },
  
  on_list_selected: async (row, message, sender, group) => {
    const payload = row.id.split(' ')
    const responseName = payload[0]
    const parameters = payload.slice(1)
    const responseItem = commandHandler.listResponseList.find(r=>r.name===responseName)
    if (!responseItem) return
    try {await responseItem.run({parameters, message, sender, group})}
    catch (e) {
      const target = group?.id || sender.id
      bot.sendText(target, e.toString())
      const errorReport =
        `*Error Report*\n` +
        `Event: On List Selected\n` +
        `Room: ${group?.name || sender.id}\n` +
        `Details:\n${e.message}\n${e.stack}`
      bot.sendText(bot.getOwnerId(), errorReport)
    }
  }
})

function saveMedia(messageInfo) {
  const keyId = messageInfo.key.id
  const timestamp = messageInfo.messageTimestamp
  console.log('Saving media', keyId)
  return database.set('media_'+keyId+'_'+timestamp, messageInfo)
}

async function deleteExpiredMedia(expirationDuration) {
  const keys = (await database.list('media_'))
    .filter(k=>{
      const timestamp = k.split('_')[2]
      const nowSeconds = Date.now() / 1000
      if (nowSeconds - timestamp > expirationDuration) return true
    })
  if (keys.length) console.log('Removing', keys.length, 'old media')
  return database.removeMultiple(keys)
}
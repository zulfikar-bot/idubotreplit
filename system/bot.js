const baileys = require('@adiwajshing/baileys')
const { downloadMediaMessage } = baileys
const ffmpegPath = require('ffmpeg-static')
process.env.FFMPEG_PATH = ffmpegPath
const { Sticker } = require('wa-sticker-formatter')


const hybridReplitDBAuthState = require('./hybrid-replit-db-auth-state')
const database = require('./replit-db')
const {streaming} = require('../extra/tools')

let botNumber = '', botId = '',
    ownerNumber = '', ownerId = ''

const tempStore = {}

const getMessage = async (key) => {
  const {id} = key
  console.log('Resending', id)
  console.log(tempStore[id])
  return tempStore[id]?.message
}

let client
async function start(events) {
  const {state, saveCreds} = await hybridReplitDBAuthState('baileys')
  client = baileys.default({
    auth: state,
    getMessage,
    printQRInTerminal: true,
  })
  client.ev.on('creds.update', saveCreds)
  client.ev.on('connection.update', async (update) => {
    if (update.connection === "close") {
      if (update.lastDisconnect.error.output.statusCode === 401) {
        console.log("UNAUTHORIZED. Deleting login data...");
        await database.removePrefixed('baileys')
      } 
      start(events)
    } 
    if (update.receivedPendingNotifications) {
      if (events.on_ready) events.on_ready()
    }
  })
  client.ev.on('messages.upsert', async ({messages, type}) => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (!m.message) continue
      const key = m.key
      if (key.fromMe) continue
      const jid = key.remoteJid
      if (baileys.isJidStatusBroadcast(jid)) continue

      const msg = m.message.ephemeralMessage?.message || m.message
      const filterTypes = ['senderKeyDistributionMessage', 'messageContextInfo']
      const type = Object.keys(msg).filter(t=>!filterTypes.includes(t))[0]

      if (type) client.readMessages([key])

      const mapType = (type, msgObj) => {
        if (type === 'imageMessage') return 'image'
        if (type === 'videoMessage') return msgObj.videoMessage.gifPlayback ? 'gif' : 'video'
        if (type === 'audioMessage') return msgObj.audioMessage.ptt ? 'vn' : 'audio'
        if (type === 'documentMessage') return 'document'
        return type
      }
      const getMsgText = (msgObj) => {
        return msgObj.conversation || msgObj.extendedTextMessage?.text ||
        msgObj.imageMessage?.caption || msgObj.videoMessage?.caption ||
        msgObj.documentMessage?.fileName || msgObj.reactionMessage?.text ||
        msgObj.listResponseMessage?.title || ''
      }
      const text = getMsgText(msg)
      const room = jid
      const quoted = msg.extendedTextMessage?.contextInfo?.quotedMessage
      const quotedId = quoted && msg.extendedTextMessage?.contextInfo?.stanzaId
      const quotedType = quoted && Object.keys(quoted).filter(t=>!filterTypes.includes(t))[0]
      const quotedText = quoted && getMsgText(quoted)

      const senderId = key.participant || jid
      const senderName = m.pushName
      const isOwner = senderId === ownerId

      const isGroup = baileys.isJidGroup(jid)
      const groupMeta = isGroup ? (await client.groupMetadata(jid)) : null
      const groupSubject = groupMeta?.subject
      
      const message = { 
        type: mapType(type, msg), 
        text, room, 
        quoted: {
          id: quotedId,
          type: mapType(quotedType, quoted),
          text: quotedText,
          getMessageObject: () => quoted,
        },
        getMessageInfo: () => m,
        reply: async (text, mentions) => sendText(room, text, m, mentions),
        getMediaBuffer: async () => await getMediaBuffer(m)
      }
      const sender = { id:senderId, name:senderName, isOwner }
      const group = isGroup ? { id:jid, name:groupSubject } : null
      if (events.on_message) await events.on_message(message, sender, group)
      if (type === 'listResponseMessage' && events.on_list_selected) {
        const row = {title:text, id:msg.listResponseMessage.singleSelectReply.selectedRowId}
        events.on_list_selected(row, message, sender, group)
      }
    }
  })
  setInterval(clearTempStore, 60*1000)
}

function clearTempStore() {
  let count = 0
  for (const id in tempStore) {
    const msgTime = tempStore[id].messageTimestamp
    const now = Date.now() / 1000
    if (now - msgTime > 60) {delete tempStore[id]; count ++}
  }
  count > 0 && console.log(`Clearing ${count} messages from tempStore...`)
}

function setNumber(number) {
  botNumber = number.toString()
  botId = botNumber + baileys.S_WHATSAPP_NET
}

function setOwner(number) {
  ownerNumber = number.toString()
  ownerId = ownerNumber + baileys.S_WHATSAPP_NET
}

function getOwnerId() {
  return ownerId
}

function getOwnerNumber() {
  return ownerNumber
}

async function updateProfilePicture(url) {
  const stream = await streaming(url)
  console.log('Updating profile picture...')
  return client.updateProfilePicture(botId, {stream})
}

async function sendText(targetId, text, replyTo, mentions) {
  const sent = await client.sendMessage(targetId, {text, mentions}, {quoted:replyTo, ephemeralExpiration:'chat'}) 
  tempStore[sent.key.id] = sent
}

async function sendList(targetId, title, text, footer, buttonText, sections, replyTo) {
  const listMessage = {
    title,
    text,
    footer,
    buttonText,
    sections,
  }
  const sent = await client.sendMessage(targetId, listMessage, {quoted: replyTo, ephemeralExpiration:'chat'})
  tempStore[sent.key.id] = sent
}

async function sendDocument(targetId, link, fileName, mimetype, replyTo) {
  const sent = await client.sendMessage(targetId, {document:{url:link}, fileName, mimetype}, {quoted: replyTo, ephemeralExpiration:'chat'})
  tempStore[sent.key.id] = sent
  const sentMsg = { 
    type:'document', text:fileName, room:targetId,
    getMessageInfo: () => sent,
    reply: async (text, mentions) => sendText(targetId, text, sent, mentions),
    forward: async (to) => forward(sentMsg, to)
  }
  return sentMsg
}

async function sendAudio(targetId, link, mimetype, replyTo) {
  const sent = await client.sendMessage(
    targetId, {audio:{stream:await streaming(link)}, mimetype}, 
    {quoted: replyTo, ephemeralExpiration:'chat'}
  )
  tempStore[sent.key.id] = sent
}

async function sendVideo(targetId, link, replyTo) {
  const sent = await client.sendMessage(
    targetId, {video:{stream:await streaming(link)}}, 
    {quoted: replyTo, ephemeralExpiration:'chat'}
  )
  tempStore[sent.key.id] = sent
}

async function sendSticker(targetId, stickerData, replyTo) {
  const {buffer, pack, author} = stickerData
  const sticker = new Sticker(buffer, {
    pack,
    author,
    type: 'full',
    id: Date.now().toString(),
    quality: 50
  })
  const sent = await client.sendMessage(
    targetId, await sticker.toMessage(), 
    {quoted: replyTo, ephemeralExpiration:'chat'}
  )
  tempStore[sent.key.id] = sent
}

async function forward(msg, to) {
  const sent = await client.sendMessage(to, {forward: msg.getMessageInfo()})
  tempStore[sent.key.id] = sent
  const sentMsg = { 
    type:msg.type, text:msg.text, room:to,
    getMessageInfo: () => sent,
    reply: async (text, mentions) => sendText(to, text, sent, mentions),
    forward: async (to) => forward(sentMsg, to)
  }
  return sentMsg
}

async function getMediaBuffer(messageInfo) {
  return await downloadMediaMessage(messageInfo, 'buffer', {}, {reuploadRequest:client.updateMediaMessage})
}

module.exports = {
  start, setNumber, setOwner, updateProfilePicture, getOwnerId, getOwnerNumber, 
  sendText, sendList, sendSticker, sendVideo,
  sendDocument, sendAudio, getMediaBuffer
}
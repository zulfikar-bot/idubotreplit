const { randomInt } = require('crypto')
const fs = require('fs')
const tools = require('./tools')

let roomData, 
    dataPath = __dirname + '/bba_room_data.json',
    githubRawPath = 'https://github.com/',
    githubRepo = 'aidulcandra/materi-bahasa-asing'

const cache = {}

const languageList = [
  {code:'en', name:'English', indo:'Bahasa Inggris'},
  {code:'ja', name:'Nihon-go', indo:'Bahasa Jepang'},
  {code:'de', name:'Deutsch', indo:'Bahasa Jerman'},
  {code:'es', name:'Español', indo:'Bahasa Spanyol'},
]

function loadRoomData() {
  try {
    if (!roomData) roomData = JSON.parse(fs.readFileSync(dataPath))
  } catch {
    roomData = {}
  }
  return roomData
}

function saveRoomData() {
  fs.writeFileSync(dataPath, JSON.stringify(roomData))
}

function getRoomCodes(roomId) {
  const roomData = loadRoomData()
  const codes = []
  for (const c in roomData) {
    if (roomData[c].includes(roomId)) codes.push(c)
  }
  return codes
}

function isRegistered(roomId) {
  const codes = getRoomCodes(roomId)
  return codes.length > 0
}

function getAllCodes() {
  return languageList.map(l=>l.code)
}

function codeExists(code) {
  return languageList.find(l=>l.code===code) !== undefined
}

function getLanguages() {
  return JSON.parse(JSON.stringify(languageList)) 
}

function getRoomLanguages(roomId) {
  return getRoomCodes(roomId).map(c=>languageList.find(l=>l.code===c))
}

function registerRoom(roomId, code) {
  if (!codeExists(code)) throw new Error(`BBA: Unknown code: ${code}`)
  const roomData = loadRoomData()
  if (!roomData[code]) roomData[code] = []
  if (roomData[code].includes(roomId)) return
  roomData[code].push(roomId)
  saveRoomData()
}

function unregisterRoom(roomId, code) {
  if (!codeExists(code)) throw new Error(`BBA: Unknown code: ${code}`)
  const roomData = loadRoomData()
  if (!roomData[code]?.includes(roomId)) return
  const pos = roomData[code].indexOf(roomId)
  roomData[code].splice(pos, 1)
  saveRoomData()
}

function getLanguageName(code) {
  const language = languageList.find(l=>l.code===code)
  if (!language) throw new Error(`BBA: Unknown code: ${code}`)
  return language.name
}

async function getMaterialList(code) {
  if (!codeExists(code)) throw new Error('BBA: Unknown code: '+code)
  const cacheKey = 'material_list_'+code
  if (cache[cacheKey]) return cache[cacheKey]
  const request = await tools.getHttps(`${githubRawPath}${githubRepo}/raw/main/${code}/list.json`)
  cache[cacheKey] = JSON.parse(request.data)
  return cache[cacheKey]
}

async function getMaterial(code, id) {
  if (!codeExists(code)) throw new Error('BBA: Unknown code: '+code)
  const cacheKey = 'material_'+code+'_'+id
  if (cache[cacheKey]) return cache[cacheKey]
  const materialList = await getMaterialList(code)
  const materialItem = materialList[id]
  if (!materialItem) return null
  const filename = materialItem.link
  const request = await tools.getHttps(`${githubRawPath}${githubRepo}/raw/main/${code}/files/${filename}`)
  cache[cacheKey] = request.data
  return request.data
}

async function getRandomMaterial(code) {
  if (!codeExists(code)) throw new Error('BBA: Unknown code: '+code)
  const materialList = await getMaterialList(code)
  return getMaterial(code, randomInt(materialList.length))
}

async function searchMaterial(code, keywords) {
  if (!codeExists(code)) throw new Error('BBA: Unknown code: '+code)
  const materialList = await getMaterialList(code)
  const searchResult = materialList.map((m,i)=>{
    let score = 0
    for (const k of keywords) {
      if (m.title.toLowerCase().includes(k.toLowerCase())) score ++
      const titleMatches = m.title.toLowerCase().match(new RegExp('\b'+k.toLowerCase()+'\b', 'g'))
      score += titleMatches?.length || 0
      for (const t of m.tags) {
        if (t.toLowerCase() === k.toLowerCase()) score ++
      }
    }
    m.score = score
    m.index = i
    return m
  })
  return searchResult.filter(r=>r.score>0).sort((a,b)=>b.score - a.score)
}

module.exports = {
  isRegistered, getAllCodes, getLanguages, registerRoom, getLanguageName, codeExists,
  getRoomLanguages, getRoomCodes, unregisterRoom, getRandomMaterial, getMaterial, getMaterialList,
  searchMaterial,
}
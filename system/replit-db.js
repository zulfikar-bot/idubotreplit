const Database = require('@replit/database')
const db = new Database()

const cache = {}

async function set (key, value) {
  await db.set(key, value)
  cache[key] = value
}

async function get (key) {
  const cached = cache[key]
  if (cached) return cached
  return await db.get(key)
}

async function remove (key) {
  await db.delete(key)
  delete cache[key]
}

async function removePrefixed (prefix) {
  const keys = await db.list(prefix+'_')
  await db.deleteMultiple(keys)
  keys.forEach(k => delete cache[k])
}

async function removeMultiple (keys) {
  await db.deleteMultiple(...keys)
  keys.forEach(k => delete cache[k])
}

async function list (prefix) {
  const keys = await db.list(prefix)
  return keys
}

module.exports = {
  set, get, remove, removePrefixed, removeMultiple, list
}
const fs = require('fs')
const fsp = require('fs/promises')
const baileys = require('@adiwajshing/baileys')
const {BufferJSON, proto} = baileys
const {initAuthCreds} = baileys
const database = require('./replit-db')

const hybridReplitDBAuthState = async (keyPrefix) => {
  const keysPath = __dirname+'/hybrid-auth-keys/'+keyPrefix
  const keyName = (key) => `${keyPrefix}_${key}`
  const getPath = (key) => `${keysPath}/${key}.json`
  
  const writeData = (data, key) => {
    return database.set(keyName(key), JSON.stringify(data, BufferJSON.replacer))
  }
  const writeDataFS = (data, key) => {
    return fsp.writeFile(getPath(key), JSON.stringify(data, BufferJSON.replacer))
  }
	const readData = async (key) => {
    try {
      const data = await database.get(keyName(key))
      return JSON.parse(data, BufferJSON.reviver)
    } catch {
      return null
    }
	}
  const readDataFS = async (key) => {
    try {
      const data = await fsp.readFile(getPath(key))
      return JSON.parse(data, BufferJSON.reviver)
    } catch {
      return null
    }
	}
	const removeData = async(key) => {
    try {
      await database.remove(keyName(key))  
    } catch {}
	}
	const removeDataFS = async(key) => {
    try {
      await fsp.unlink(getPath(key))  
    } catch {}
	}

  if (!fs.existsSync(keysPath)) {
    fs.mkdirSync(keysPath, {recursive:true})
  }

  

  const creds = await readData('creds') || initAuthCreds()
  return {
    state: {
      creds,
      keys: {
        get: async(type, ids) => {
          const data = { }
          await Promise.all(
            ids.map(
              async id => {
                let value = await readDataFS(`${type}-${id}`)
                if(type === 'app-state-sync-key' && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value)
                }
                data[id] = value
              }
            )
          )
          return data
        },
        set: async(data) => {
          const tasks = []
          for(const category in data) {
            for(const id in data[category]) {
              const value = data[category][id]
              const key = `${category}-${id}`
              tasks.push(value ? writeDataFS(value, key) : removeDataFS(key))
            }
          }
          await Promise.all(tasks)
        }
      }
    },
    saveCreds: () => {
      return writeData(creds, 'creds')
    }
  }
}

module.exports = hybridReplitDBAuthState
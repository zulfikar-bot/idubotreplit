const baileys = require('@adiwajshing/baileys')
const {BufferJSON, proto} = baileys
const {initAuthCreds} = baileys

const database = require('./replit-db')

const replitDBAuthState = (keyPrefix) => {
  const keyName = (key) => `${keyPrefix}_${key}`
  
  const writeData = (data, key) => {
    return database.set(keyName(key), JSON.stringify(data, BufferJSON.replacer))
  }
	const readData = async (key) => {
    try {
      const data = await database.get(keyName(key))
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

  const creds = await readData('creds') || initAuthCreds()
  return {
    state: {
      creds,
      keys: {
        get: async(type, ids) => {
          const data: = { }
          await Promise.all(
            ids.map(
              async id => {
                let value = await readData(`${type}-${id}`)
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
              tasks.push(value ? writeData(value, key) : removeData(key))
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

module.exports = replitDBAuthState
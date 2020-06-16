const Discord = require('discord.js')
const firebase = require('@firebase/app').default
require('@firebase/firestore')
const pkm = require('pokemon')

const { randomSpawn } = require('./spawns')
const { getSprite } = require('./sprites')

require('./typdef')

const MAX_ID = +process.env.MAX_ID || 151
const SPAWN_PROBABILITY = +process.env.SPAWN_PROBABILITY || 0.1

const client = new Discord.Client()

/** @type {Object.<string, Spawn>} */
const currentSpawnsByGuild = {}

/** @type {firebase.firestore.Firestore} */
const db = firebase.firestore()

client.on('message', message => {
  if (message.author.id === client.user.id) {
    return
  }
  if (ignore(message.guild)) {
    return
  }
  if (isDexRequest(message)) {
    sendDex(message)
  } else if (isCatchAttempt(message)) {
    resolveCatchAttempt(message)
  } else if (Math.random() < SPAWN_PROBABILITY) {
    spawnPokémon(message.guild)
  }
})

client.on('guildCreate', guild => {
  if (ignore(guild)) {
    return
  }
  doScheduledSpawn(guild)
})

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  client.guilds.cache.filter(guild => !ignore(guild)).each(doScheduledSpawn)
})

/**
 * @param {Discord.Message} message
 * @returns {boolean}
 */
function isDexRequest (message) {
  return message.content.toLowerCase().startsWith('dex')
}

/**
 * @param {Discord.Message} message
 * @returns {boolean}
 */
function isCatchAttempt (message) {
  const spawnChannel = getSpawnChannel(message.guild)
  if (!spawnChannel) {
    return false
  }
  if (message.channel !== spawnChannel) {
    return false
  }
  return message.content.toLowerCase().startsWith('catch')
}

/**
 * @param {Discord.Message} message
 * @returns {void}
 */
function sendDex (message) {
  const { guild, author } = message
  const dex = getDexRef(guild, author)
  dex.get().then(snapshot => {
    if (snapshot.empty) {
      message.reply('you haven’t caught any Pokémon yet!').catch(error)
      return
    }
    const dex = new Array(MAX_ID + 1).fill(undefined).map(() => emptyEntry())
    snapshot.forEach(doc => {
      const id = parseInt(doc.id)
      if (id < MAX_ID) {
        dex[id] = doc.data()
      }
    })
    const pageMatch = message.content.match(/^dex p(\d+)$/)
    const page = pageMatch === null ? 1 : parseInt(pageMatch[1])
    const caught = dex.filter(entry => entry.caught > 0).length
    const totalPages = Math.ceil(MAX_ID / 10)
    let content = `**<@${author.id}>’s Pokédex** (page ${page} of ${totalPages})\n` +
      `**Caught: ${caught} / ${MAX_ID}**\n\n`
    for (let i = 1; i <= 10; i++) {
      const id = (page - 1) * 10 + i
      if (id > MAX_ID) {
        break
      }
      let paddedId = id.toString()
      while (paddedId.length < 3) {
        paddedId = '0' + paddedId
      }
      const { caught, male, female, genderless, shiny } = dex[id]
      const name = caught > 0 ? pkm.getName(id) : '???'
      content += `**#${paddedId} ${name}** (Caught: ${caught})\n`
      if (caught === 0) {
        content += '❌'
      } else {
        if (male) {
          content += '♂️ '
        }
        if (female) {
          content += '♀️ '
        }
        if (genderless) {
          content += '⏺️ '
        }
        if (shiny) {
          content += '✨'
        }
      }
      content += '\n'
    }
    message.channel.send(content).catch(error)
  })
}

/**
 * @param {Discord.Message} message
 * @returns {void}
 */
function resolveCatchAttempt (message) {
  if (!isCatchAttempt(message)) {
    return
  }
  const { guild, channel, author, content } = message
  const spawn = currentSpawnsByGuild[guild.id]
  if (!spawn) {
    message.reply('there’s nothing to catch!').catch(error)
    return
  }
  const attempt = content.substring('catch'.length).trim()
  if (isCorrect(attempt, spawn)) {
    let reply = `Gotcha! <@${author.id}> caught ${spawn.name}!`
    if (spawn.gender !== 'genderless') {
      reply += spawn.gender === 'male' ? ' ♂️' : ' ♀️'
    }
    if (spawn.shiny) {
      reply += ' ✨'
    }
    currentSpawnsByGuild[guild.id] = undefined
    recordCatch(guild, author, spawn)
    channel.send(reply).then(() => {
      console.log(`[${guild.name}] ${author.username} caught ${spawn.name}`)
    }).catch(error)
  } else {
    message.reply('that’s not the name of this Pokémon!').catch(error)
  }
}

/**
 * @param {string} attempt
 * @param {Spawn} spawn
 * @returns {boolean}
 */
function isCorrect (attempt, spawn) {
  if (isCaseInsensitiveMatch(attempt, spawn.name)) {
    return true
  }
  switch (spawn.id) {
    case 29:
    case 32:
      return isCaseInsensitiveMatch(attempt, 'Nidoran')
    case 83:
      return isCaseInsensitiveMatch(attempt, 'Farfetch\'d')
    default:
      return false
  }
}

/**
 * @param {string} attempt
 * @param {string} name
 * @returns {boolean}
 */
function isCaseInsensitiveMatch (attempt, name) {
  return attempt.toLowerCase() === name.toLowerCase()
}

/**
 * @param {Discord.Guild} guild
 * @returns {void}
 */
function doScheduledSpawn (guild) {
  spawnPokémon(guild)
  const minutesUntilNextSpawn = 30 + (Math.random() * 30)
  setTimeout(() => {
    doScheduledSpawn(guild)
  }, minutesUntilNextSpawn * 60 * 1000)
}

/**
 * @param {Discord.Guild} guild
 * @returns {void}
 */
function spawnPokémon (guild) {
  const spawn = randomSpawn(MAX_ID)
  const channel = getSpawnChannel(guild)
  const file = getSprite(spawn)
  let content = '**A wild Pokémon appeared!**'
  if (spawn.shiny) {
    content += ' ✨'
  }
  if (channel) {
    channel.send(content, { files: [file] }).then(() => {
      currentSpawnsByGuild[guild.id] = spawn
    }).then(() => {
      console.log(`[${guild.name}] ${spawn.shiny ? 'Shiny ' : ''}${spawn.name} appeared`)
    }).catch(error)
  }
}

/**
 * @param {Discord.Guild} guild
 * @returns {Discord.TextChannel}
 */
function getSpawnChannel (guild) {
  const channel = guild.channels.cache.find(channel => channel.name === 'pokemon-dungeon')
  return channel.type === 'text' ? channel : undefined
}

/**
 * @param {Discord.Guild} guild
 * @param {Discord.User} author
 * @param {Spawn} spawn
 * @returns {void}
 */
function recordCatch (guild, author, spawn) {
  const entryRef = getDexRef(guild, author).doc(spawn.id.toString())
  entryRef.get().then(doc => {
    /** @type {DexEntry} */
    const entry = doc.exists ? doc.data() : emptyEntry()
    entry.caught++
    entry[spawn.gender] = true
    entry.shiny = entry.shiny || spawn.shiny
    entryRef.set(entry)
  }).catch(error)
}

/**
 * @param {Discord.Guild} guild
 * @param {Discord.User} author
 * @returns {firebase.firestore.CollectionReference<firebase.firestore.DocumentData>}
 */
function getDexRef (guild, author) {
  return db.collection('guilds').doc(guild.id).collection('pokedexes').doc(author.id).collection('entries')
}

/**
 * @returns {DexEntry}
 */
function emptyEntry () {
  return {
    caught: 0,
    male: false,
    female: false,
    genderless: false,
    shiny: false
  }
}

/**
 * @param {Discord.Guild} guild
 * @returns {boolean}
 */
function ignore (guild) {
  if (!guild) {
    return true
  }
  const isTestClient = this.process.env.ENV !== 'production'
  const isTestGuild = guild.id === this.process.env.TEST_GUILD
  return isTestClient !== isTestGuild
}

/**
 * @param {any} err
 */
function error (err) {
  console.error(err)
}

module.exports = client

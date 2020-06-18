const Discord = require('discord.js')
const firebase = require('@firebase/app').default
require('@firebase/firestore')

const aliases = require('./aliases')
const { hasMaleForm, hasFemaleForm, hasGenderlessForm } = require('./genders')
const { getId, getName } = require('./pokemon')
const { randomSpawn } = require('./spawns')
const { getSprite } = require('./sprites')

require('./typdef')

const MAX_ID = +process.env.MAX_ID || 151
const SPAWN_PROBABILITY = +process.env.SPAWN_PROBABILITY || 0.1

const DEX_PAGE_SIZE = 10
const totalDexPages = Math.ceil(MAX_ID / DEX_PAGE_SIZE)

const client = new Discord.Client()

/** @type {Object.<string, Spawn>} */
const currentSpawnsByGuild = {}

/** @type {firebase.firestore.Firestore} */
const db = firebase.firestore()

client.on('message', message => {
  if (ignore(message.guild)) {
    return
  }
  if (message.author.id === client.user.id) {
    // Message posted by this bot.
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

client.on('messageReactionAdd', (reaction, user) => {
  const { message, emoji } = reaction
  const { guild, author, content, channel, mentions } = message
  if (ignore(guild)) {
    return
  }
  if (!canManageDexPaging(channel)) {
    return
  }
  if (user.id === client.user.id) {
    // Emoji added by this bot.
    return
  }
  if ((author.id !== client.user.id) || !content.includes('Pokédex')) {
    // Not Pokédex message.
    return
  }
  reaction.users.remove(user).then(() => {
    const pageMatch = content.match(/Page (\d+) of/)
    if (!pageMatch) {
      return
    }
    const page = parseInt(pageMatch[1])
    const emojiString = emoji.toString()
    const dexUser = mentions.users.first()
    if (emojiString === '⬅') {
      const previousPage = page === 1 ? totalDexPages : page - 1
      getDexPage(guild, dexUser, previousPage).then(content => message.edit(content)).catch(error)
    } else if (emojiString === '➡') {
      const nextPage = page === totalDexPages ? 1 : page + 1
      getDexPage(guild, dexUser, nextPage).then(content => message.edit(content)).catch(error)
    }
  })
})

client.on('guildCreate', guild => {
  if (ignore(guild)) {
    return
  }
  initGuild(guild)
})

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  client.guilds.cache.filter(guild => !ignore(guild)).each(initGuild)
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
  const { guild, author, channel } = message
  const page = parseRequestedDexPage(message)
  getDexPage(guild, author, page)
    .then(content => {
      if (content) {
        let promise = channel.send(content)
        if (canManageDexPaging(channel)) {
          promise = promise
            .then(message => message.react('⬅'))
            .then(reaction => reaction.message.react('➡'))
        }
        promise.catch(error)
      } else {
        message.reply('you haven’t caught any Pokémon yet!').catch(error)
      }
    }).catch(error)
}

/**
 * @param {Discord.Message} message
 * @returns {number}
 */
function parseRequestedDexPage (message) {
  const { content } = message
  let match = null
  if ((match = content.match(/^dex p(\d+)$/i))) {
    const page = parseInt(match[1])
    return page <= totalDexPages ? page : 1
  }
  let id = null
  if ((match = content.match(/^dex (\d+)$/i))) {
    id = parseInt(match[1])
  } else if ((match = content.match(/^dex (.+)$/i))) {
    id = getId(match[1])
  }
  if (!id) {
    return 1
  }
  return id <= MAX_ID ? Math.ceil(id / DEX_PAGE_SIZE) : 1
}

/**
 * @param {Discord.Guild} guild
 * @param {Discord.User} user
 * @param {number} page
 * @returns {Promise<string>}
 */
function getDexPage (guild, user, page) {
  const dex = getDexRef(guild, user)
  return dex.get().then(snapshot => {
    if (snapshot.empty) {
      return null
    }
    const dex = new Array(MAX_ID + 1).fill(undefined).map(() => emptyEntry())
    snapshot.forEach(doc => {
      const id = parseInt(doc.id)
      if (id < MAX_ID) {
        dex[id] = doc.data()
      }
    })
    const caught = dex.filter(entry => entry.caught > 0).length
    let content = `**<@${user.id}>’s Pokédex**\n` +
      `**${caught} / ${MAX_ID} (${Math.floor(caught * 1000 / MAX_ID) / 10}%)**\n\n`
    const emojis = getGuildDexEmojis(guild)
    for (let i = 1; i <= DEX_PAGE_SIZE; i++) {
      const id = (page - 1) * DEX_PAGE_SIZE + i
      if (id > MAX_ID) {
        content += '.\n.\n'
        continue
      }
      let paddedId = id.toString()
      while (paddedId.length < 3) {
        paddedId = '0' + paddedId
      }
      const entry = dex[id]
      const name = entry.caught > 0 ? getName(id) : '???'
      content += `**#${paddedId} ${name}** (Caught: ${entry.caught})\n`
      content += getDexEntryEmojis(id, entry, emojis)
      content += '\n'
    }
    content += '\n'
    content += `Page ${page} of ${totalDexPages}`
    return content
  })
}

/**
 * @param {Discord.Guild} guild
 * @returns {GuildDexEmojis}
 */
function getGuildDexEmojis (guild) {
  function find (name) {
    const emoji = guild.emojis.cache.find(emoji => emoji.name === name)
    return emoji ? `<:${emoji.identifier}>` : undefined
  }
  return {
    male: {
      registered: find('pokewire_male') || '♂',
      unregistered: find('pokewire_male_dot') || '❌'
    },
    female: {
      registered: find('pokewire_female') || '♀',
      unregistered: find('pokewire_female_dot') || '❌'
    },
    genderless: {
      registered: find('pokewire_genderless') || '⏺',
      unregistered: find('pokewire_genderless_dot') || '❌'
    }
  }
}

/**
 * @param {number} id
 * @param {DexEntry} entry
 * @param {GuildDexEmojis} emojis
 * @returns {string}
 */
function getDexEntryEmojis (id, entry, emojis) {
  const { male, female, genderless, shiny } = entry
  const entryEmojis = []
  if (hasMaleForm(id)) {
    entryEmojis.push(male ? emojis.male.registered : emojis.male.unregistered)
  }
  if (hasFemaleForm(id)) {
    entryEmojis.push(female ? emojis.female.registered : emojis.female.unregistered)
  }
  if (hasGenderlessForm(id)) {
    entryEmojis.push(genderless ? emojis.genderless.registered : emojis.genderless.unregistered)
  }
  if (shiny) {
    entryEmojis.push('✨')
  }
  return entryEmojis.join(' ')
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
    const emojis = getGuildDexEmojis(guild)
    let reply = `Gotcha! <@${author.id}> caught ${spawn.name}! ${emojis[spawn.gender].registered}`
    if (spawn.shiny) {
      reply += ' ✨'
    }
    currentSpawnsByGuild[guild.id] = undefined
    recordCatch(guild, author, spawn)
    const options = {}
    if (spawn.disguise) {
      // Reveal disguised Pokémon.
      options.files = [getSprite(spawn)]
    }
    channel.send(reply, options).then(() => {
      console.log(`[${guild.name}] ${author.username} caught ${spawn.name}`)
    }).catch(error)
  } else if (spawn.disguise && isCorrect(attempt, spawn.disguise)) {
    channel.send(`Oh? That does look like ${spawn.disguise.name} but it isn’t one! What else could it be, <@${author.id}>?`)
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
  const spawnAliases = aliases[spawn.id] || []
  return spawnAliases.some(alias => isCaseInsensitiveMatch(attempt, alias))
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
function initGuild (guild) {
  guild.channels.cache.each(channel => {
    if (channel.type === 'text' && canManageDexPaging(channel)) {
      // Fetch old dex messages to listen for paging reactions.
      channel.messages.fetch({ limit: 100 })
    }
  })
  doScheduledSpawn(guild)
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
  const file = getSprite(spawn.disguise || spawn)
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
 * @param {Discord.TextChannel} channel
 * @returns {boolean}
 */
function canManageDexPaging (channel) {
  const permissions = channel.permissionsFor(client.user)
  return permissions.has('ADD_REACTIONS') && permissions.has('MANAGE_MESSAGES')
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

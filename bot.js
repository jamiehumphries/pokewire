const Discord = require('discord.js')
const _ = require('lodash')
const pkm = require('pokemon')

const { randomSpawn } = require('./spawns')
const { getSpriteURL } = require('./sprites')

const client = new Discord.Client()

const CATCH_KEYWORD = process.env.CATCH_KEYWORD || 'catch'
const DEX_KEYWORD = process.env.DEX_KEYWORD || 'dex'
const SPAWN_CHANNEL = process.env.SPAWN_CHANNEL || 'pokemon-dungeon'
const SPAWN_PROBABILITY = +process.env.SPAWN_PROBABILITY || 0.1
const MAX_ID = +process.env.MAX_ID || 151

const pokédexes = {}
let currentSpawn = null

client.on('message', message => {
  if (message.author.id === client.user.id) {
    return
  }
  if (isCatchAttempt(message)) {
    resolveCatchAttempt(message)
  } else if (isPokédexRequest(message)) {
    sendPokédex(message)
  } else if (Math.random() < SPAWN_PROBABILITY) {
    spawnPokémon(message)
  }
})

function isCatchAttempt (message) {
  const spawnChannel = getSpawnChannel(message)
  if (!spawnChannel) {
    return false
  }
  if (message.channel !== spawnChannel) {
    return false
  }
  return message.content.toLowerCase().startsWith(CATCH_KEYWORD.toLowerCase())
}

function isPokédexRequest (message) {
  return message.content.toLowerCase().startsWith(DEX_KEYWORD.toLowerCase())
}

function sendPokédex (message) {
  const matcher = new RegExp(`^${DEX_KEYWORD} p(\\d+)$`)
  const pageMatch = matcher.exec(message.content)
  const page = pageMatch === null ? 1 : parseInt(pageMatch[1])
  const { author } = message
  const pokédex = pokédexes[author.id]
  if (!pokédex) {
    message.reply('you haven’t caught any Pokémon yet!')
    return
  }
  const caught = pokédex.filter(entry => entry.caught > 0).length
  const totalPages = Math.ceil(MAX_ID / 10)
  let content = `**<@${author.id}>’s Pokédex** (page ${page} of ${totalPages})\n` +
    `**Caught: ${caught} / ${MAX_ID}**\n\n`
  for (let i = 1; i <= 10; i++) {
    const id = (page - 1) * 10 + i
    if (id > MAX_ID) {
      break
    }
    let paddedID = id.toString()
    while (paddedID.length < 3) {
      paddedID = '0' + paddedID
    }
    const entry = pokédex[id]
    const name = entry.caught > 0 ? pkm.getName(id) : '???'
    content += `**#${paddedID} ${name}** (Caught: ${entry.caught})\n`
    if (entry.caught === 0) {
      content += '❌'
    } else {
      if (entry.male) {
        content += '♂️ '
      }
      if (entry.female) {
        content += '♀️ '
      }
      if (entry.genderless) {
        content += '⏺️ '
      }
      if (entry.shiny) {
        content += '✨'
      }
    }
    content += '\n'
  }
  message.channel.send(content)
}

function resolveCatchAttempt (message) {
  if (!isCatchAttempt(message)) {
    return
  }
  if (!currentSpawn || !currentSpawn.name) {
    message.reply('there’s nothing to catch!')
    return
  }
  const attempt = message.content.substring(CATCH_KEYWORD.length).trim()
  if (isMatch(attempt, currentSpawn)) {
    let reply = `Gotcha! <@${message.author.id}> caught ${currentSpawn.name}!`
    if (currentSpawn.gender !== null) {
      reply += currentSpawn.gender === 'male' ? ' ♂️' : ' ♀️'
    }
    if (currentSpawn.shiny) {
      reply += ' ✨'
    }
    recordCatch(message.author, currentSpawn)
    currentSpawn = undefined
    message.channel.send(reply)
  } else {
    message.reply('that’s the not the name of this Pokémon!')
  }
}

function isMatch (attempt, spawn) {
  switch (spawn.id) {
    case 29:
    case 32:
      return isCaseInsensitiveMatch(attempt, spawn.name) ||
        isCaseInsensitiveMatch(attempt, 'Nidoran')
    case 83:
      return isCaseInsensitiveMatch(attempt, spawn.name) ||
        isCaseInsensitiveMatch(attempt, 'Farfetch\'d')
    default:
      return isCaseInsensitiveMatch(attempt, spawn.name)
  }
}

function isCaseInsensitiveMatch (attempt, name) {
  return attempt.toLowerCase() === name.toLowerCase()
}

function spawnPokémon (message) {
  const spawn = randomSpawn(MAX_ID)
  const file = getSpriteURL(spawn)
  let content = '**A wild Pokémon appeared!**'
  if (spawn.shiny) {
    content += ' ✨'
  }
  currentSpawn = spawn
  const channel = getSpawnChannel(message)
  if (channel) {
    channel.send(content, { files: [file] })
  }
}

function getSpawnChannel (message) {
  return message.guild.channels.cache.find(channel => channel.name === SPAWN_CHANNEL)
}

function recordCatch (author, spawn) {
  if (!pokédexes[author.id]) {
    pokédexes[author.id] = new Array(1000).fill(undefined).map((_, i) => {
      return { 
        caught: 0,
        male: false,
        female: false,
        genderless: false,
        shiny: false
      }
    })
  }
  const pokédex = pokédexes[author.id]
  const entry = pokédex[spawn.id]
  entry.caught++
  entry[spawn.gender] = true
  entry.shiny = entry.shiny || spawn.shiny
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

module.exports = client

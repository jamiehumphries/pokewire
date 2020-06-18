const pokemon = require('pokemon')

const aliases = require('./aliases')

/**
 * @param {string} name
 * @returns {number}
 */
function getId (name) {
  // Transform name to Title Case.
  // e.g. 'mr. mime' becomes 'Mr. Mime'.
  name = name.split(' ')
    .filter(part => !!part)
    .map(part => part[0].toUpperCase() + part.substring(1).toLowerCase())
    .join(' ')
  try {
    return pokemon.getId(name)
  } catch {
    const matchedAlias = Object.keys(aliases).find(id => aliases[parseInt(id)].includes(name))
    return matchedAlias ? parseInt(matchedAlias) : null
  }
}

/**
 * @param {number} id
 * @returns {string}
 */
function getName (id) {
  switch (id) {
    // Force non-emoji gender symbols for Nidoran.
    case 29:
      return 'Nidoran\u2640\uFE0E'
    case 32:
      return 'Nidoran\u2642\uFE0E'
    default:
      return pokemon.getName(id)
  }
}

module.exports = {
  getId,
  getName
}

require('./typdef')

/**
 * @type {Array.<Generation>}
 */
module.exports = Object.freeze([
  { name: 'Kanto', minId: 1, maxId: 151 },
  { name: 'Johto', minId: 152, maxId: 251 },
  { name: 'Hoenn', minId: 252, maxId: 386 },
  { name: 'Sinnoh', minId: 387, maxId: 493 },
  { name: 'Unova', minId: 494, maxId: 649 },
  { name: 'Kalos', minId: 650, maxId: 721 },
  { name: 'Alola', minId: 722, maxId: 807 },
  { name: 'Unknown', minId: 808, maxId: 809 },
  { name: 'Galar', minId: 810, maxId: 890 }
])

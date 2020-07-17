/**
 * @typedef {('male'|'female'|'genderless')} Gender
 */

/**
 * @typedef Spawn
 * @property {number} id
 * @property {string} name
 * @property {Gender} gender
 * @property {boolean} shiny
 * @property {Spawn} [disguise]
 */

/**
 * @typedef DexEntry
 * @property {number} caught
 * @property {boolean} male
 * @property {boolean} female
 * @property {boolean} genderless
 * @property {boolean} shiny
 */

/**
 * @typedef DexEntryEmojis
 * @property {string} registered
 * @property {string} unregistered
 */

/**
 * @typedef GuildDexEmojis
 * @property {DexEntryEmojis} male
 * @property {DexEntryEmojis} female
 * @property {DexEntryEmojis} genderless
 */

/**
 * @typedef {('Kanto'|'Johto'|'Hoenn'|'Sinnoh'|'Unova'|'Kalos'|'Alola'|'Unknown'|'Galar')} Region
 */

/**
 * @typedef Generation
 * @property {Region} name
 * @property {number} minId
 * @property {number} maxId
 */

/**
 * @file willie-miouzik - Module configuration
 */
// (C) Alexandre Morin 2016

const defaultConfig = {
  name: "miouzik",
  path: __dirname + "/..",
  version: "1.0",

  // list of menu items to insert on the application home page (/). The index attribute is used to control the display order
  homeMenu: [
    { label:"Miouzik", href:"/miouzik/player.html", index:250 }
  ],

  // list of menu items to insert on the left-side menu. The index attribute is used to control the display order
  "sideMenu": [
    { name:"miouzik:miouzik",  label:"Miouzik",    href:"/miouzik/player.html",   icon:"/miouzik/images/miouzik.svg",   index:300 }
  ],

  // Collections to scan
  // Should be set in config.json
  collections: undefined,

  // Ignore files smaller than this value
  minFileSize: 12*1024,

  // Ignore files larger than this value
  maxFileSize: 52428800,

  // Exclude the following files/folders
  exclude: [
  ],

  // Include only the following file patterns (case-insensitive)
  include: [
    "*.mp3", "*.m4a"
  ],

  // The folder where covers will be cached
  albumsThumbsDir: undefined,
  artistsThumbsDir: undefined,

  // Discogs keys
  discogs: {
    key: undefined,
    secret: undefined
  }
}

function _checkConfig(config, callback) {
  return callback(undefined, config);
}

/**
 * Public interface
 * @ignore
 */
module.exports = {
  defaultConfig: defaultConfig,
  check: _checkConfig
}

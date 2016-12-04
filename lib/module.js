/**
 * willie-miouzik - Module definition
 */
// (C) Alexandre Morin 2016

const fs = require('fs');
const extend = require('extend');
const moment = require('moment');
const uuid = require('uuid');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const Database = require('wg-database').Database;
const Scanner = require('wg-scanner').Scanner;
const ScannerDb = require('willie-photos').ScannerDb;

const coredb = require('willie-core').Database;
const photodb = require('willie-photos').Database;

const ModuleConfig = require('./config.js');
const ID3Handler = require('./scanners/id3.js');
const CoverHandler = require('./scanners/cover.js');
const miouzikdb = require('./database.js');


const log = Log.getLogger('willie-miouzik::module');


/** ================================================================================
  * Delegate to access long-term storage
  * ================================================================================ */

function newDatabaseProgressDelegate(db, userContext) {
  var delegate = new ScannerDb.DatabaseProgressDelegate(db, userContext);
  return delegate;
}

function newDatabaseStorageDelegate(db, userContext) {
  var joins = [
    {
      table: "miouzik_songs",
      alias: "s",
      node: "song",
      select: [
        { expr:"s.id",            as:"sid",               attr:"uuid"           },
        { expr:"s.version",       as:"sversion",          attr:"version"        },
        { expr:"s.tagMTime",      as:"stagmtime",         attr:"tagMTime"       },
        { expr:"s.title",         as:"stitle",            attr:"title"          },
        { expr:"s.album",         as:"salbum",            attr:"album"          },
        { expr:"s.artist",        as:"sartist",           attr:"artist"         },
        { expr:"s.year",          as:"syear",             attr:"year"           },
        { expr:"s.trackNumber",   as:"strack",            attr:"trackNumber"    },
        { expr:"s.genre",         as:"sgenre",            attr:"genre"          }
      ]
    },
    {
      table: "miouzik_discogs_releases",
      alias: "r",
      node: "release",
      on: "r.id = s.discogsReleaseId",
      select: [
        { expr:"r.id",            as:"rid",               attr:"id"             },
        { expr:"r.release",       as:"rrelease",          attr:"release"        },
      ]
    },
    {
      table: "miouzik_discogs_artists",
      alias: "a",
      node: "artist",
      on: "a.id = s.discogsArtistId",
      select: [
        { expr:"a.id",            as:"aid",               attr:"id"             },
        { expr:"a.artist",        as:"aartist",           attr:"artist"         },
      ]
    }
  ];
  var delegate = new ScannerDb.DatabaseStorageDelegate(db, userContext, joins);

  /**
   * Store a song in the database
   */
  delegate.storeSong = function(song, callback) {
    var that = this;
    return miouzikdb.storeSong(that.db, that.userContext, song, function(err, uuid) {
      return callback(err, uuid);
    });
  }

  /**
   * Load a cached Discogs query result
   */
  delegate.loadDiscogsQueryResult = function(query, callback) {
    var that = this;
    return miouzikdb.loadDiscogsQueryResult(that.db, that.userContext, query, function(err, releases) {
      return callback(err, releases);
    });
  }

  /**
   * Cache a Discogs query result
   */
  delegate.cacheDiscogsQueryResult = function(query, result, callback) {
    var that = this;
    return miouzikdb.cacheDiscogsQueryResult(that.db, that.userContext, query, result, function(err, releases) {
      return callback(err, releases);
    });
  }

  /**
   * Cache a Discogs artist
   */
  delegate.storeDiscogsRelease = function(id, release, callback) {
    var that = this;
    return miouzikdb.storeDiscogsRelease(that.db, that.userContext, id, release, function(err, releases) {
      return callback(err, releases);
    });
  }

  /**
   * Cache a Discogs release
   */
  delegate.storeDiscogsArtist = function(id, artist, callback) {
    var that = this;
    return miouzikdb.storeDiscogsArtist(that.db, that.userContext, id, artist, function(err, releases) {
      return callback(err, releases);
    });
  }

  return delegate;
}













/** ================================================================================
  * Module life cycle
  * ================================================================================ */

/**
 * 
 * @class Module
 */
function Module() {
  this.config = undefined;
  this.moduleConfig = ModuleConfig.defaultConfig;
  this.modules = [];
}

/**
 * Start the module.
 * @memberOf Module
 *
 * @param config - Willie application configuration
 * @param modules - Array of willie modules
 */
Module.prototype.start = function(config, moduleConfig, modules, callback) {
  var that = this;
  log.debug("Starting module");
  moduleConfig = extend(true, {}, ModuleConfig.defaultConfig, moduleConfig);
  return ModuleConfig.check(moduleConfig, function(err) {
    if (err) return callback(new Exception(undefined, "Configuration fail checked", err));
    log.debug({err:err, moduleConfig:moduleConfig}, "Configuration loaded.");
    if (err) return callback(err);
    that.config = config;
    that.moduleConfig = moduleConfig;
    that.modules = modules;
    log.debug("Module started");
    return callback();
  });
}

/**
 * Shuts down the module.
 * @memberOf Module
 *
 * @param {Module~shutdown_callback} callback - is the return function
 */
Module.prototype.shutdown = function(callback) {
  log.debug("Shutting down module");
  var that = this;
  return callback();
}
/**
 * Callback for the shutdown function.
 * @ignore
 *
 * @callback Module~shutdown_callback
 * @param err - is the error code/message
 *
 * @see shutdown
 */


/** ================================================================================
  * Scan command: scan the collection
  *
  * - no arguments => (re)scan the whole collection
  * - 1 argument (file or directory) => only (re)scan the specified file or directory
  * ================================================================================ */
Module.prototype.scanCommand = function(argv, callback) {
  var that = this;
  var scanOptions = {
    force: false,
    discogs: that.moduleConfig.discogs,
    albumsThumbsDir: that.moduleConfig.albumsThumbsDir,
    artistsThumbsDir: that.moduleConfig.artistsThumbsDir
  };
  if (argv.length>0) {
    var filename = process.argv[0];
    if (filename === '-force') {
      scanOptions.force = true;
      process.argv.shift();
      filename = process.argv[0];
    }
    log.info({argv:argv, filename:filename}, "Executing 'scan' command (limiting scope to file/folder)");
    process.argv.shift();
    if (filename !== "" && filename !== null && filename !== undefined) {
      return fs.lstat(filename, function(err, stats) {
        if (err) return callback(err);
        log.debug({ filename:filename, stats:stats }, "Scanning file");
        var scope;
        if (stats.isDirectory())  scope = Scanner.newDirectoryScope(filename);
        else                      scope = Scanner.newFilesScope([ filename ]);
        return that._runScan(scope, scanOptions, function(err) {
          return callback(err);
        });
      });
    }
  }

  log.info({argv:argv}, "Executing 'scan' command (scanning all)");
  return that._runScan(undefined, scanOptions, function(err) {
    return callback(err);
  });
}

Module.prototype._runScan = function(scope, scanOptions, callback) {
  var that = this;
  log.info({ scope:scope }, "Executing scan command");
  var tsStart = moment();
  var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
  var db = new Database(that.config.cnx);

  var endScan = function(err, cumulatedStats) {
    if (err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    }
    var tsEnd = moment();
    log.info({stats:cumulatedStats, duration:tsEnd.diff(tsStart, 'seconds')}, "Cumulated statistics");
    //return photodb.updateLastScanned(db, adminContext, tsEnd.toDate(), function(err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    //});
  }

  if (scope === undefined) {
    var cumulatedStats = { forward: {scanned:0, processed:0, errors:0}, reverse:{scanned:0, processed:0, errors:0} };
    var collections = that.moduleConfig.collections.slice(0);
    return that._scanNextCollection(db, adminContext, collections, scanOptions, cumulatedStats, function(err) {
      return endScan(err, cumulatedStats);
    });
  }
  return that._scanScope(db, adminContext, scope, scanOptions, function(err, stats) {
    return endScan(err, stats);
  })
}

Module.prototype._scanNextCollection = function(db, userContext, collections, scanOptions, cumulatedStats, callback) {
  var that = this;
  if (collections.length === 0) return callback(null);
  var collection = collections.shift();
  var folder = collection.folder;
  return that._scanFolder(db, userContext, folder, scanOptions, function(err, stats) {
    if (err) return callback(err);
    cumulatedStats.forward.scanned = cumulatedStats.forward.scanned + stats.forward.scanned;
    cumulatedStats.forward.processed = cumulatedStats.forward.processed + stats.forward.processed;
    cumulatedStats.forward.errors = cumulatedStats.forward.errors + stats.forward.errors;
    cumulatedStats.reverse.scanned = cumulatedStats.reverse.scanned + stats.reverse.scanned;
    cumulatedStats.reverse.processed = cumulatedStats.reverse.processed + stats.reverse.processed;
    cumulatedStats.reverse.errors = cumulatedStats.reverse.errors + stats.reverse.errors;
    return that._scanNextCollection(db, userContext, collections, scanOptions, cumulatedStats, callback);
  });
}

Module.prototype._scanFolder = function(db, userContext, folder, scanOptions, callback) {
  var that = this;
  var scope = Scanner.newDirectoryScope(folder);
  scope.includeFiles(that.moduleConfig.include).
    exclude(that.moduleConfig.exclude).
    excludeFilesLargerThan(that.moduleConfig.maxFileSize).
    excludeFilesSmallerThan(that.moduleConfig.minFileSize);
  return that._scanScope(db, userContext, scope, scanOptions, callback);
};

Module.prototype._scanScope = function(db, userContext, scope, scanOptions, callback) {
  var that = this;
  var storageDelegate = newDatabaseStorageDelegate(db, userContext);
  var progressDelegate = newDatabaseProgressDelegate(db, userContext);
  var handlers = [ID3Handler, CoverHandler];
  return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, function(err, stats) {
    return callback(err, stats);
  });
};



/**
 * Parse command line arguments and run command.
 * @memberOf Module
 * 
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the command name
 * @param {Module~command_callback} callback - is the return function
 */
Module.prototype.command = function(argv, callback) {
  var that = this;
  var command = process.argv[0];  // command

  // Decode module options
  while (command && command[0]==='-') {
    log.warn({ arg:command}, "Ignoring parameter");
    command = process.argv[0];
    process.argv.shift();
  }
  argv.shift();

  // Execute commands
  if (command === 'scan')         return that.scanCommand(argv, callback);          // scan folder and create database

  return callback(new Exception({command:command}, "Invalid command"));
}
/**
 * Callback for the command function.
 *
 * @callback Module~command_callback
 * @param err - is the error code/message
 *
 * @see command
 */


/**
 * help command: display help
 * @memberOf Module
 * @return a multi-line string containing the module help
 */
Module.prototype.getHelpString = function() {
  var that = this;
  var help = "Miouzik\n"
           + "Options:\n"
           + "    No options for this module\n"
           + "Commands:\n"
           + "    scan [options] [<filename>]   Incrementally scan the collection\n"
           + "                                  Without arguments, the whole collection is scanned\n"
           + "                                  filename can be either a file or a folder\n"
           + "          -force                  Force a full rescan\n"
  return help;
}



/**
 * Start background jobs
 * @memberOf Module
 *
 * @param web -
 * @patam {function} callback - return function
 */Module.prototype.startBackgroundJobs = function(web, callback) {
  return callback();
}



/**
 * Load a module file
 * @param {string} relativePath - is the file name, relative to the module root
 * @param {function} callback - is the return function, passing the file contents
 */
Module.prototype.loadTextFile = function(relativePath, callback) {
  var filename = __dirname + '/../' + relativePath;
  log.debug({filename:filename}, "Loading text file from module");
  return fs.readFile(filename, 'utf8', function(err, contents) {
    return callback(err, contents);
  });
}


/**
 * Public interface
 */
module.exports = Module;


/**
 * @file willie-miouzik - Web Application
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */
const extend = require('extend');
const fs = require('fs');
const path = require('path');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;

const miouzikdb = require('./database.js');

var log = Log.getLogger('willie-miouzik::web');


/**
 * @module core/web
 */

/** ================================================================================
  * Web App Lifecycle
  * ================================================================================ */

/**
 */
function WebApp(helper, module) {
  this.helper = helper;
  this.module = module;

  var that = this;
  helper.registerValidator('collection', function(value, defaultValue, callback) {
    var collection = undefined;
    var list = that.module.moduleConfig.collections;
    for (var i=0; i<list.length; i++) {
      if (+(list[i].id) === +(value)) {
        collection = list[i];
        break;
      }
    }
    if (!collection) return callback(new Exception({collectionId:value}, "Collection not found"));
    return callback(undefined, collection);
  });
}

/**
 * Start the web application
 * 
 * @param helper -
 * @param callback - 
 */
WebApp.prototype.start = function(express, app, callback) {
  var that = this;

  app.use('/miouzik/css',                           express.static(__dirname + "/../css"));
  app.use('/miouzik/js',                            express.static(__dirname + "/../js"));
  app.use('/miouzik/images',                        express.static(__dirname + "/../images"));

  app.get('/miouzik/player.html',                   function(req, res) { return that.player(req, res); });
  
  app.get('/miouzik/collections',                   function(req, res) { return that.getCollections(req, res); });
  app.get('/miouzik/artists/:collection',           function(req, res) { return that.getArtists(req, res); });
  app.get('/miouzik/songs/:collection/:byArtist',   function(req, res) { return that.getSongs(req, res); });
  app.get('/miouzik/stream/:uuid',                  function(req, res) { return that.getAudioStream(req, res); });
  app.get('/miouzik/cover/album/:releaseId',        function(req, res) { return that.getAlbumCover(req, res); });
  app.get('/miouzik/cover/artist/:artistId',        function(req, res) { return that.getArtistCover(req, res); });
  app.patch('/miouzik/song/:uuid',                  function(req, res) { return that.patchSong(req, res); });
  app.patch('/miouzik/song/:uuid/play',             function(req, res) { return that.patchSongPlay(req, res); });

  return that.startBackgroundJobs(function(err) {
    if (err) return callback(new Exception({module:that.module.moduleConfig.name}, "Failed to start background jobs", err));
    return callback();
  });
}



/**
 * Get statistics (for the help page) for this module
 */
WebApp.prototype.getModuleStats = function(db, userContext, callback) {
  var that = this;
  var stats = {
    counts: {
      songCount: 0,
      artistCount: 0,
      albumCount: 0
    },
    distByYear: undefined,
    distByGenre: undefined
  };
  return miouzikdb.countSongs(db, userContext, function(err, counts) {
    if (err) return callback(err);
    stats.counts = counts;
    return miouzikdb.getSongsDistributionByYear(db, userContext, function(err, dist) {
      if (err) return callback(err);
      stats.distByYear = dist;

      return miouzikdb.getSongsDistributionByGenre(db, userContext, function(err, dist) {
        if (err) return callback(err);
        stats.distByGenre = dist;

        var statsWithModuleName = {};
        statsWithModuleName[that.module.moduleConfig.name] = stats;
        return callback(undefined, statsWithModuleName);
      });
    });
  });
}


/** ================================================================================
  * Background jobs
  * ================================================================================ */

/**
 * Start background jobs
 */
WebApp.prototype.startBackgroundJobs = function(callback) {
  var that = this;
  return callback();
}


/** ================================================================================
  * Views
  * ================================================================================ */

/**
 * This page (miouzik/player.html) display the player
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.player = function(req, res) {
  var that = this;
  var helper = that.helper;

  log.info("Displaying the 'player' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = { 
      title: 'Miouzik player',
      message: 'Miouzik player'
    };
    return helper.render(res, userContext, 'player', options);
  });
}


/** ================================================================================
  * APIs
  * ================================================================================ */

/**
 * Web: get list of collections
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getCollections = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting list of collections");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    
    var collections = [];
    var list = that.module.moduleConfig.collections;
    for (var i=0; i<list.length; i++) {
      var collection = list[i];
      collections.push({
        id: collection.id,
        name: collection.name,
        default: collection.default
      });
    }
    return helper.sendJSON(collections, req, res);
  });
}

/**
 * Web: get list of trees as a JSON array (facetted search)
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getArtists = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting list of artists");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);

    return helper.getParameters(['collection|params|collection'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      return miouzikdb.loadArtists(db, userContext, params.collection.folder, function(err, artists) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(artists, req, res);
      });
    });
  });
}

/**
 * Web: get the cover for a song
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getAlbumCover = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting the cover for an album");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['releaseId|number'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      var fileName = that.module.moduleConfig.albumsThumbsDir + "/" + params.releaseId + ".jpg";
      if (params.releaseId === 0) fileName = path.resolve(__dirname + '/../images/song.png');
      log.debug({ fileName:fileName }, "Returning ablum image");
      return fs.lstat(fileName, function(err, stats) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendFile(fileName, stats.mtime, null, req, res);
      });
    });
  });
}

/**
 * Web: get the cover image for an artist
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getArtistCover = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting the cover for an artist");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['artistId|number'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      var fileName = that.module.moduleConfig.artistsThumbsDir + "/" + params.artistId + ".jpg";
      if (params.artistId === 0) fileName = path.resolve(__dirname + '/../images/artist.png');
      log.debug({ fileName:fileName }, "Returning artist image");
      return fs.lstat(fileName, function(err, stats) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendFile(fileName, stats.mtime, null, req, res);
      });
    });
  });
}

/**
 * Web: get the list of songs for an artist
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getSongs = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting list of songs for an artist");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['byArtist', 'collection|params|collection'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ byArtist:params.byArtist, collection:params.collection }, "Retreiving songs");
      return miouzikdb.loadSongs(db, userContext, params.byArtist, params.collection.folder, function(err, songs) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(songs, req, res);
      });
    });
  });
}

/**
 * Web: get the audio stream for a song
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.getAudioStream = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Getting the audio stream for a song");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid }, "Retreiving audio stream");
      return miouzikdb.loadSong(db, userContext, params.uuid, function(err, song) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendFile(song.fingerprint.longFilename, song.fingerprint.mtime, song.fingerprint.md5, req, res);
      });
    });
  });
}


/**
 * Web: patch a song record
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
WebApp.prototype.patchSong = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Patching song");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid, body:req.body }, "Patching song");
      var patch = extend(true, {}, req.body, {uuid:params.uuid} );
      return miouzikdb.storeSong(db, userContext, patch, function(err, songId) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return miouzikdb.loadSong(db, userContext, songId, function(err, song) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          return helper.sendJSON(song, req, res);
        });
      });
    });
  });
}

WebApp.prototype.patchSongPlay = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Patching song (play)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid, body:req.body }, "Patching song");
      var patch = { uuid:params.uuid, playCount: function() { return "playCount+1"; } };
      return miouzikdb.storeSong(db, userContext, patch, function(err, songId) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return miouzikdb.loadSong(db, userContext, songId, function(err, song) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          return helper.sendJSON(song, req, res);
        });
      });
    });
  });
}



/**
 * Public interface
 * @ignore
 */
module.exports = WebApp;


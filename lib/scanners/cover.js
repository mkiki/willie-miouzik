/**
 * willie-miouzik - File cover scanner
 * 
 * This is a reverse-scanner which walks every fingerprint in the database and
 * extracts ID3 tags and store them in the database
 *
 */
// (C) Alexandre Morin 2015 - 2016

const fs = require('fs');
const fse = require('fs-extra');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Utils = require('wg-utils');
const Discogs = require('wg-discogs').Discogs;
const Database = require('wg-database').Database;


const database = require('../database.js');

const log = Log.getLogger('willie-miouzik::scanners::cover');


/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
CoverHandler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
  this.albumsThumbsDir = scanOptions.albumsThumbsDir;
  this.artistsThumbsDir = scanOptions.artistsThumbsDir;
  this.discogs = new Discogs(scanOptions.discogs.key, scanOptions.discogs.secret);
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
CoverHandler.prototype.getName = function() { return "CoverHandler"; };

/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * Fetch and persist album covers
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
CoverHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var wasProcessed = false;
  return that._processNext_extractCover(fingerprint, stats, isInScope, scanOptions, function(err, processed) {
    if (err) return callback(err);
    wasProcessed = wasProcessed | processed;
    return that._processNext_extractArtistCover(fingerprint, stats, isInScope, scanOptions, function(err, processed) {
      if (err) return callback(err);
      wasProcessed = wasProcessed | processed;
      return callback(undefined, wasProcessed);
    });
  });
}

CoverHandler.prototype._discogsError = function(exception, callback) {
  if (exception) {
    return callback(exception);
  }  
}


CoverHandler.prototype._processNext_extractCover = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  var force = scanOptions.force;
  var reasons = [];
  var song = fingerprint.song;
  var release = fingerprint.release;
  if (song === null || song === undefined) reasons.push("Song record not found");
  if (song && fingerprint.mtime && stats.mtime && fingerprint.mtime<stats.mtime) reasons.push("File changed since last scan");
  if (release && (release.id===undefined || release.id===null)) reasons.push("Discogs release id not set");
  if (song && song.version <= 1) reasons.push("Record version requires cover update");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, song:song, stats:stats, shouldStore:shouldStore, reasons:reasons }, "CoverHandler processing next file (extract cover)");
  if (!shouldStore) return callback();
  return that._extractCover(fingerprint, song, release, reasons, scanOptions, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}

CoverHandler.prototype._processNext_extractArtistCover = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  var force = scanOptions.force;
  var reasons = [];
  var song = fingerprint.song;
  var artist = fingerprint.artist;
  if (artist && !artist.id) reasons.push("Discogs artist id not set");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, song:song, stats:stats, shouldStore:shouldStore, reasons:reasons }, "CoverHandler processing next file (extract artist cover)");
  if (!shouldStore) return callback();
  return that._extractArtistCover(fingerprint, song, artist, reasons, scanOptions, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}


CoverHandler.prototype._getRelease = function(song, release, scanOptions, callback) {
  var that = this;
  var force = scanOptions.force;
  if (release && release.id) 
    return callback(undefined, release);
  if (song.artist === '' || song.album === '') {
    log.debug({artist:song.artist, album:song.album}, "Incomplete song information (artist, album) - skipping Discogs search");  
    return callback(undefined, release);
  }
  log.debug({artist:song.artist, album:song.album}, "Fetching release info on Discogs");

  function _extractRelease(releases) {
    log.debug({artist:song.artist, album:song.album, releases:releases}, "Found Discogs releases");
    var release = null;
    for (var i=0; i<releases.length; i++) {
      if (release === null) release = releases[i];
      if (release && release.thumb==="" && releases[i].thumb !== "") {
        release = releases[i];
        break;
      }
    }
    return callback(undefined, release);    
  }

  function _cacheNextRelease(releases, index, callback) {
    if (index >= releases.length) return callback();
    var release = releases[index];
    return that.reverseScanner.getStorageDelegate().storeDiscogsRelease(release.id, release, function(err) {
      if (err) return callback(new Exception({artist:song.artist, album:song.album, index:index, release:release}, "Failed to save Discogs release", err));
      return _cacheNextRelease(releases, index+1, callback);;
    });    
  }

  var query = song.artist + "||" + song.album;
  return that.reverseScanner.getStorageDelegate().loadDiscogsQueryResult(query, function(err, releases) {
    if (err) return callback(new Exception({artist:song.artist, album:song.album}, "Failed to load cached query result", err));
    if (/*!force &&*/ releases) return _extractRelease(releases.releases);
    return that.discogs.searchReleases(song.artist, song.album, function(err, releases) {
      if (err) return that._discogsError(new Exception({artist:song.artist, album:song.album}, "Failed to fetch release info on Discogs", err), callback);
      return _cacheNextRelease(releases, 0, function(err) {
        if (err) return callback(new Exception({artist:song.artist, album:song.album}, "Failed to cache releases", err));
        return that.reverseScanner.getStorageDelegate().cacheDiscogsQueryResult(query, {releases:releases}, function(err) {
          if (err) return callback(new Exception({artist:song.artist, album:song.album}, "Failed to cache Discogs query result", err));
          return _extractRelease(releases);
        });
      });
    });
  });
}


CoverHandler.prototype._getCover = function(baseDir, id, thumbURL, scanOptions, callback) {
  var that = this;
  var force = scanOptions.force;
  if (id ===0) return callback();
  if (!thumbURL || thumbURL.length === 0) return callback();
  var fileName = baseDir + '/' + id + ".jpg";
  // Check if file cover is already cached
  return fs.exists(fileName, function(exists) {
    if (/*!force &&*/ exists) return callback(undefined, fileName);
    // Create covers cache dir if needed
    return fse.mkdirs(baseDir, function(err) {
      if (err) return callback(new Exception({id:id, baseDir:baseDir}, "Failed to create covers cache dir", err));
      // Get cover from discogs
      log.debug({id:id, fileName:fileName}, "Fetching thumb on Discogs");
      var wstream = fs.createWriteStream(fileName);
      return that.discogs.getAlbumArt(thumbURL, wstream, function(err) {
        if (err) return that._discogsError(new Exception({id:id, thumbURL:thumbURL}, "Failed to fetch image from Discogs", err), callback);
        wstream.end();
        return callback(undefined, fileName);
      });
    });
  });
}

CoverHandler.prototype._getReleaseCover = function(release, scanOptions, callback) {
  var that = this;
  if (!release || release.id === 0 || release.id === undefined || release.id === null) return callback();
  return that._getCover(that.albumsThumbsDir, release.id, release.thumb, scanOptions, callback);
}


CoverHandler.prototype._extractCover = function(fingerprint, song, release, reasons, scanOptions, callback) {
  var that = this;
  log.info({fingerprint:fingerprint.longFilename, reasons:reasons}, "Extracting song cover");
  return that._getRelease(song, release, scanOptions, function(err, release) {
    if (err) return callback(err);
    return that._getReleaseCover(release, scanOptions, function(err) {
      if (err) return callback(err);      
debugger;
      var releaseId = 0;
      if (release && release.id) releaseId = release.id;

      var song = {
        uuid:               fingerprint.uuid,
        discogsReleaseId:   releaseId,
        version:            2
      };
      return that.reverseScanner.getStorageDelegate().storeSong(song, function(err) {
        if (err) return callback(err);
        return callback(err, song);
      });
      return callback();

    });
  });
}


CoverHandler.prototype._getArtist = function(song, artist, scanOptions, callback) {
  var that = this;
  var force = scanOptions.force;
  if (artist && artist.id) 
    return callback(undefined, artist);
  log.debug({artist:song.artist, album:song.album}, "Fetching artist info on Discogs");

  function _extractArtist(artists) {
    log.debug({artist:song.artist, album:song.album, artists:artists}, "Found Discogs artists");
    var artist = null;
    for (var i=0; i<artists.length; i++) {
      if (artist === null) artist = artists[i];
      if (artist && artist.thumb==="" && artists[i].thumb !== "") {
        artist = artists[i];
        break;
      }
    }
    return callback(undefined, artist);    
  }

  function _cacheNextArtist(artists, index, callback) {
    if (index >= artists.length) return callback();
    var artist = artists[index];
    return that.reverseScanner.getStorageDelegate().storeDiscogsArtist(artist.id, artist, function(err) {
      if (err) return callback(new Exception({artist:song.artist, index:index, artist:artist}, "Failed to save Discogs artist", err));
      return _cacheNextArtist(artists, index+1, callback);;
    });    
  }

  var query = song.artist;
  return that.reverseScanner.getStorageDelegate().loadDiscogsQueryResult(query, function(err, artists) {
    if (err) return callback(new Exception({artist:song.artist}, "Failed to load cached query result", err));
    if (/*!force &&*/ artists) return _extractArtist(artists.artists);
    return that.discogs.searchArtists(song.artist, function(err, artists) {
      if (err) return that._discogsError(new Exception({artist:song.artist}, "Failed to fetch artist info on Discogs", err), callback);
      return _cacheNextArtist(artists, 0, function(err) {
        if (err) return callback(new Exception({artist:song.artist}, "Failed to cache artists", err));
        return that.reverseScanner.getStorageDelegate().cacheDiscogsQueryResult(query, {artists:artists}, function(err) {
          if (err) return callback(new Exception({artist:song.artist}, "Failed to cache Discogs query result", err));
          return _extractArtist(artists);
        });
      });
    });
  });
}

CoverHandler.prototype._getArtistCover = function(artist, scanOptions, callback) {
  var that = this;
  if (!artist || artist.id ===0) return callback();
  return that._getCover(that.artistsThumbsDir, artist.id, artist.thumb, scanOptions, callback);
}

CoverHandler.prototype._extractArtistCover = function(fingerprint, song, artist, reasons, scanOptions, callback) {
  var that = this;
  log.info({fingerprint:fingerprint.longFilename, reasons:reasons}, "Extracting artist cover");
  return that._getArtist(song, artist, scanOptions, function(err, artist) {
    if (err) return callback(err);
    return that._getArtistCover(artist, scanOptions, function(err) {
      if (err) return callback(err);      

      var artistId = 0;
      if (artist) artistId = artist.id;

      var song = {
        uuid:               fingerprint.uuid,
        discogsArtistId:    artistId
      };
      return that.reverseScanner.getStorageDelegate().storeSong(song, function(err) {
        if (err) return callback(err);
        return callback(err, song);
      });
      return callback();
    });
  });
}


/**
 * Public interface
 * @ignore
 */
module.exports = CoverHandler;


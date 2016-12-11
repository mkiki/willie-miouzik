/**
 * willie-miouzik - ID3 scanner
 * 
 * This is a reverse-scanner which walks every fingerprint in the database and
 * extracts ID3 tags and store them in the database
 *
 */
// (C) Alexandre Morin 2015 - 2016

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Utils = require('wg-utils');
const Discogs = require('wg-discogs').Discogs;
const Database = require('wg-database').Database;
const ID3 = require('wg-id3').ID3;
const M4A = require('wg-id3').M4A;

const database = require('../database.js');

const log = Log.getLogger('willie-miouzik::scanners::id3');


/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
ID3Handler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
ID3Handler.prototype.getName = function() { return "miouzik:ID3Handler"; };


/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * Extracts and persist ID3 (v2) tags
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
ID3Handler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var force = scanOptions.force;
  var reasons = [];
  var song = fingerprint.song;
  if (song === null || song === undefined) reasons.push("Song record not found");
  if (song && fingerprint.mtime && stats.mtime && fingerprint.mtime<stats.mtime) reasons.push("File changed since last scan");
  if (song && song.version <= 0) reasons.push("ID3 tag not computed yet");
  if (song && (song.tagMTime === null || song.tagMTime === undefined)) reasons.push("ID3 tag mtime not set");
  if (song && song.tagMTime && song.tagMTime < fingerprint.mtime) reasons.push("File modified since last time we computed ID3 tag");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, song:song, stats:stats, shouldStore:shouldStore, reasons:reasons }, "ID3Handler processing next file");
  if (!shouldStore) return callback();
  return that._extractID3(fingerprint, reasons, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}

ID3Handler.prototype._extractTag = function(longFilename, callback) {
  var ext = Utils.getExtension(longFilename);
  if (ext === 'mp3') {
    var id3 = new ID3();
    return id3.read(longFilename, function(err, tag) {
      return callback(err, tag);
    });
  }
  if (ext === 'm4a') {
    var m4a = new M4A();
    return m4a.read(longFilename, function(err, tag) {
      return callback(err, tag);
    });    
  }
  return callback(undefined, null);
}

ID3Handler.prototype._extractID3 = function(fingerprint, reasons, callback) {
  var that = this;
  log.info({ fingerprint:fingerprint.longFilename, uuid:fingerprint.uuid, reasons:reasons }, "Extracting ID3 tag");
  return that._extractTag(fingerprint.longFilename, function(err, tag) {
    if (err) return callback(err);
    log.debug({ fingerprint:fingerprint.longFilename, uuid:fingerprint.uuid, tag:tag }, "ID3 tag extracted");
    var song = {
      uuid:               fingerprint.uuid,
      version:            1,
      tagMTime:           fingerprint.mtime,
      title:              tag ? tag.title : "",
      artist:             tag ? tag.artist : "",
      album:              tag ? tag.album : "",
      year:               tag ? tag.year : null,
      trackNumber:        tag ? tag.trackNumber : null
    };
    return that.reverseScanner.getStorageDelegate().storeSong(song, function(err) {
      if (err) return callback(err);
      fingerprint.song = song;
      return callback(err, song);
    });
  });
}

/**
 * Public interface
 * @ignore
 */
module.exports = ID3Handler;


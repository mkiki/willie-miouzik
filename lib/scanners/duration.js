/**
 * willie-miouzik - File duration scanner
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

const database = require('../database.js');

const log = Log.getLogger('willie-miouzik::scanners::duration');


/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
DurationHandler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
DurationHandler.prototype.getName = function() { return "DurationHandler"; };

/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * Compute song duration
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
DurationHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var force = scanOptions.force;
  var reasons = [];
  if (song === null || song === undefined) reasons.push("Song record not found");
  if (song && fingerprint.mtime && stats.mtime && fingerprint.mtime<stats.mtime) reasons.push("File changed since last scan");
  if (song && (song.durationInSeconds === 0 || song.durationInSeconds === null || song.durationInSeconds === undefined)) reasons.push("Song duration was not computed previously");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  if (that.debug) that.log.debug({ fingerprint:fingerprint.longFilename, song:song, stats:stats, shouldStore:shouldStore, reasons:reasons }, "DurationHandler processing next file");
  if (!shouldStore) return callback();
  return that._extractDuration(fingerprint, song, reasons, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}

DurationHandler.prototype._extractDuration = function(fingerprint, song, reasons, callback) {
  var that = this;
  that.log.info({ fingerprint:fingerprint.longFilename, reasons:reasons }, "Extracting song duration");
  return ID3.extractDuration(fingerprint.longFilename, { debug:that.debug }, function(err, tag) {
    if (that.debug) that.log.debug("Duration", err, duration);
    if (err) return callback(err);
    var song = {
      uuid:               fingerprint.uuid,
      durationInSeconds:  0+duration,
    };
    return that.reverseScanner._db.storeSong(song, function(err) {
      if (err) return callback(err);
      return callback(err, song);
    });
  });
}

/**
 * Public interface
 * @ignore
 */
module.exports = DurationHandler;


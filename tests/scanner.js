/**
 * willie-miouzik - Scanner unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const Scanner = require('wg-scanner').Scanner;
const ScannerTest = require('wg-scanner').Test();

describe('Scanner', function() {

  var storageDelegate = ScannerTest.storageDelegate;
  var progressDelegate = ScannerTest.progressDelegate;

  function checkStats(cumulatedStats, fs, fp, fe, rs, rp, re) {
    assert.equal(cumulatedStats.forward.scanned, fs);
    assert.equal(cumulatedStats.forward.processed, fp);
    assert.equal(cumulatedStats.forward.errors, fe);
    assert.equal(cumulatedStats.reverse.scanned, rs);
    assert.equal(cumulatedStats.reverse.processed, rp);
    assert.equal(cumulatedStats.reverse.errors, re);
  }

  function scanDir(relativeDirName, callback) {
    var scope = Scanner.newDirectoryScope(__dirname + "/" + relativeDirName);
    var scanOptions = {
      force: false
    };
    var handlers = [];
    return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, function(err, cumulatedStats) {
      if (err) return callback(err);
      return callback(null, cumulatedStats);
    });
  }

  /** ================================================================================
    * Test various collections
    * ================================================================================ */


  describe('Test various collections', function() {
    it('Should scan empty collection', function(done) {
      return scanDir("collections/empty", function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 0, 0, 0, 0, 0, 0);
        return done();
      });
    });
  });

});



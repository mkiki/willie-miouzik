/**
 * Willie-miouzik - NPM package entry point
 */
// (C) Alexandre Morin 2015 - 2016
  
var Module = require('./lib/module.js');
var Database = require('./lib/database.js');

/**
 * Module public interface
 */
module.exports = {
  Module: new Module(),
  Database: Database,
};


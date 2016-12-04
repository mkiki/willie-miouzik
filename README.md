# Willie miouzik

The Miouzik module is a Music player, similar to iTunes.

### Collections
A collection is a hierarchy of folders on disk, owned by a user.

## Installation

	npm link wg-log
	npm link wg-utils
	npm link wg-database
	npm link wg-discogs
	npm link wg-scanner
	npm link wg-id3
	npm link willie-core
	npm link willie-photos
	npm install

## Configuration

<table>
<tr>
	<td>collections</td>
	<td>array</td>
	<td>
		The list of collections (folders) to scan. Each collection has an unique numberical id, a human readable name. One of the collections is flagged as the default one.
		<pre>
{ "id":0,   "name":"Music (Macbook)",   "folder":"/Users/amorin/Music",                       "default": false },
{ "id":1,   "name":"Alex (BigMac)",     "folder":"/Users/alex/Music/Alex",                    "default": true  },
{ "id":2,   "name":"Test (BigMac)",     "folder":"/Users/alex/Downloads/Music (test willie)", "default": false }</pre>
	</td>
</tr>
<tr>
	<td>minFileSize</td>
	<td>number</td>
	<td>Minimum size of files to scan.</td>
</tr>
<tr>
	<td>maxFileSize</td>
	<td>number</td>
	<td>Maximum size of files to scan.</td>
</tr>
<tr>
	<td>exclude</td>
	<td>string[]</td>
	<td>List of files or directories to exclude from scan</td>
</tr>
<tr>
	<td>include</td>
	<td>string[]</td>
	<td>File patterns to include in scan. By default [ "*.mp3", "*.m4a" ]</td>
</tr>
<tr>
	<td>albumsThumbsDir</td>
	<td>string</td>
	<td>The folder where albums covers will be cached</td>
</tr>
<tr>
	<td>artistsThumbsDir</td>
	<td>string[]</td>
	<td>The folder where artist images will be cached</td>
</tr>
<tr>
	<td>discogs.key</td>
	<td>string</td>
	<td>The Discogs API key</td>
</tr>
<tr>
	<td>discogs.secret</td>
	<td>string</td>
	<td>The Discogs API secret</td>
</tr>
</table>


## Database

The core module provides the following database entities.
There's no specific entities for music albums or artists, they are derived from songs.

* Songs (```miouzik_songs```)

We use [Discogs](https://www.discogs.com) to get fetch meta-data on songs and the following tables are used to cache Discogs data

* Queries (```miouzik_discogs_queries```) 
* Releases (```miouzik_discogs_releases```)
* Artists (```miouzik_discogs_artists```)


## Commands

* ```scan``` - Scan local folders or files


## APIs

### Get collections

	type: 'GET'
	url: '/miouzik/collections'
	data: { }
	dataType: 'json'

### Get artists in a collection

	type: 'GET'
	url: '/miouzik/artists/:collection'
	data: { }
	dataType: 'json'

### Get songs of an artist in a collection

	type: 'GET'
	url: '/miouzik/songs/:collection/:byArtist'
	data: { }
	dataType: 'json'

### Get the mp3 stream for a song

	type: 'GET'
	url: '/miouzik/stream/:uuid'
	data: { }

### Get an album cover

	type: 'GET'
	url: '/miouzik/cover/album/:releaseId'
	data: { }

### Get the picture of an artist

	type: 'GET'
	url: '/miouzik/cover/artist/:artistId'
	data: { }



## Pages

### Music player

	url: '/miouzik/player.html'




## Changelog

1.3.0 - Cleanup, push to github




var fs = require('fs');
var CsvReadableStream = require('csv-reader');
var express = require("express");
var pg = require("pg");
var bodyParser = require("body-parser");

var CON_STRING = process.env.DB_CON_STRING;
if (CON_STRING == undefined) {
    console.log("Error: Environment variable DB_CON_STRING not set!");
    process.exit(1);
}

pg.defaults.ssl = true;
var dbClient = new pg.Client(CON_STRING);
dbClient.connect();

var inputStream = fs.createReadStream('books.csv', 'utf8');

inputStream
    .pipe(CsvReadableStream({
        parseNumbers: false,
        parseBooleans: true,
        trim: true,
        multiline: true
    }))
    .on('data', function (row) {
        dbClient.query("INSERT INTO booklist (isbn, title, author, year) VALUES ($1, $2, $3, $4)", [row[0], row[1], row[2], row[3]], function (dbError, dbResponse) {
            console.log("inserted row: ", row);

        });

    })
    .on('end', function (data) {
        console.log('No more rows!');
    });

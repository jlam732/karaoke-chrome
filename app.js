'use strict'

var express = require("express");
var path = require("path");
var basicAuth = require("basic-auth");
var mysql = require("mysql");
var when = require("when");
var async = require("async");

var app = express();
app.set("view engine", "jade");
app.use(express.static(path.join(__dirname, "public")));

var config = require(__dirname + '/config');

var scraper = require('google-search-scraper');

//basic-auth middleware
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.auth.username && user.pass === config.auth.password) {
    return next();
  } else {
    return unauthorized(res);
  };
}

var pool = mysql.createPool({
  connectionLimit : 3,
  host     : config.mysql.host,
  port     : config.mysql.port,
  user     : config.mysql.username,
  password : config.mysql.password,
  database : config.mysql.db
});

function rsvp(first_name, last_name, contact, grouping, connection) {
  var deferred = when.defer();
  if (!first_name || !last_name) {
    deferred.reject({error: "no first or last name"});
  }
  var query_string = "INSERT INTO attendees " +
    "(first_name, last_name, contact, createdAt, grouping) " +
    "VALUES " +
    "(?, ?, ?, from_unixtime(?), ?) ";
    // "ON DUPLICATE KEY UPDATE " +
    // "contact=contact";
  var parameters = [
    first_name,
    last_name,
    contact,
    parseInt(Date.now()/1000),
    grouping
  ];

  connection.query(query_string, parameters, function(err, results) {
    if (err) {
      console.error("Error running query: " + err);
      deferred.reject({error: err});
    }
    console.log(results);
    deferred.resolve(results[0]);
  });
  return deferred.promise;
}

// app.get("/", auth, function(req, res) {
app.get("/", function(req, res) {
    res.sendFile("index.html", {root: __dirname});
});

app.get("/lyrics/list", function(req, res) {
  var data = req.query.data;
  var options = {
    query: data,
    limit: 5
  };

  var defer = when.defer();

  var results = [];
  var count = 0;
  scraper.search(options, function(err, result) {
    // This is called for each result
    if (err) {
      res.send(404);
    }
    results.push(result);
    count += 1;
    if (count === 5) {
      res.status(200).json(results);
    }
  });
});

var port = process.env.PORT || 8080;
var server = app.listen(port);
console.log("Listening on port " + port);

// pool.getConnection((err, connection) => {
//   if (err)
//     console.log(err);
//   var query_string =
//     "CREATE TABLE attendees (" +
//     "id int(11) NOT NULL AUTO_INCREMENT, " +
//     "first_name varchar(255) NOT NULL, " +
//     "last_name varchar(255) NOT NULL, " +
//     "contact varchar(255) DEFAULT NULL, " +
//     "createdAt datetime NOT NULL, " +
//     "grouping varchar(20) NOT NULL, " +
//     "PRIMARY KEY (`id`)" +
//     ")";
//   connection.query(query_string, [], (err, results) => {
//     if (err)
//       console.log(err);
//     connection.release();
//     return;
//   });
// });

// var post_data = [
//   {
//     first_name: "Grace",
//     last_name: "Chan",
//     contact: "grace@chan.com"
//   },
//   {
//     first_name: "Jon",
//     last_name: "Lam",
//     contact: "1234567890"
//   },
//   {
//     first_name: "Sample",
//     last_name: "Person"
//   }
// ];
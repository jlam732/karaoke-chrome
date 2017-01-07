'use strict'

var express = require("express");
var path = require("path");
var basicAuth = require("basic-auth");
var mysql = require("mysql");
var when = require("when");
var async = require("async");
var scraper = require('google-search-scraper');
var bodyParser = require('body-parser')

var config = require(__dirname + '/config');

var app = express();
app.set("view engine", "jade");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

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

app.post("/playlist", function(req, res) {
  var data = req.body;

  pool.getConnection((mysql_err, connection) => {
    var defer = when.defer();
    var query_string = "INSERT INTO playlist " +
      "(name, videoId, lyrics, createdAt) " +
      "VALUES " +
      "(?, ?, ?, from_unixtime(?)) ";
    var parameters = [
      data.video.snippet.title,
      data.video.id.videoId,
      data.lyrics.link,
      parseInt(Date.now()/1000)
    ];
    var item = {
      name: data.video.snippet.title,
      videoId: data.video.id.videoId,
      lyrics: data.lyrics.link
    };

    connection.query(query_string, parameters, function(err, result) {
      if (err) {
        console.error("Error running query: " + err);
        defer.reject({error: err});
      }
      defer.resolve(result.insertId);
    });

    defer.promise.then((id) => {
      item.id = id;
      return res.status(200).json(item);
    });
  });
});

var port = process.env.PORT || 8080;
var server = app.listen(port);
console.log("Listening on port " + port);

// pool.getConnection((err, connection) => {
//   if (err)
//     console.log(err);
//   var query_string =
//     "CREATE TABLE playlist (" +
//     "id int(11) NOT NULL AUTO_INCREMENT, " +
//     "name varchar(255) NOT NULL, " +
//     "videoId varchar(255) NOT NULL, " +
//     "lyrics varchar(510) DEFAULT NULL, " +
//     "createdAt datetime NOT NULL, " +
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
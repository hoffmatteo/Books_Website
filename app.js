var express = require("express");
var pg = require("pg");
var bodyParser = require("body-parser");
var session = require("express-session");
const bcrypt = require('bcrypt');
const saltRounds = 10;

var CON_STRING = process.env.DB_CON_STRING;
if (CON_STRING == undefined) {
    console.log("Error: Environment variable DB_CON_STRING not set!");
    process.exit(1);
}

pg.defaults.ssl = true;
var dbClient = new pg.Client(CON_STRING);
dbClient.connect();

var urlencodedParser = bodyParser.urlencoded({
    extended: false
});

const PORT = 3000;

var app = express();

app.use(session({
    secret: "This is a secret!",
    resave: true,
    saveUninitialized: false
}));

app.set("views", "views");
app.set("view engine", "pug");

app.get("/", function (req, res) {
    res.render("login");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", urlencodedParser, function (req, res) {
    var username = req.body.username;
    var password = req.body.password;

    dbClient.query("SELECT * FROM users WHERE username=$1", [username], function (dbError, dbResponse) {
        if (dbResponse.rows == 0) {
            res.render("login", {
                login_error: "Sorry, username and password do not match!"
            });
        } else {
            bcrypt.compare(password, dbResponse.rows[0].password, function (err, result) { //compares hash with password, result=true if passwords are identical

                if (result) {
                    req.session.username = username;
                    req.session.userID = dbResponse.rows[0].id;
                    console.log(req.session.userID);
                    res.redirect("search");

                } else {

                    res.render("login", {
                        login_error: "Sorry, username and password do not match!"
                    });
                }
            })

        }
    })
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.post("/register", urlencodedParser, function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    dbClient.query("SELECT * FROM users WHERE username=$1", [username], function (dbError, dbResponse) {
        if (dbResponse.rows != 0) {
            res.render("register", {
                register_error: "Sorry, username already exists."
            });

        } else {

            bcrypt.hash(password, saltRounds, function (err, hash) {

                dbClient.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hash], function (dbError, dbResponse) { //stores username + hash in database
                    dbClient.query("SELECT * FROM users WHERE username=$1", [username], function (dbError, dbResponse) {
                        req.session.user = username; //store username and ID in session
                        req.session.userID = dbResponse.rows[0].id;
                        console.log(req.session.userID);
                        res.redirect("search");
                    });


                });
            });
        }
    });
});


app.listen(PORT, function () {
    console.log(`Shopping App listening on Port ${PORT}`);
});

var express = require("express");
var pg = require("pg");
var bodyParser = require("body-parser");
var session = require("express-session");
const bcrypt = require('bcrypt');
const saltRounds = 10;
var books = require('google-books-search');


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
                    req.session.user = username;
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

app.get("/logout", function (req, res) {

    req.session.destroy(function (err) {
        console.log("Session destroyed");
    });
    res.render("logout");
});

app.get("/search", function (req, res) {
    var username = req.session.user;

    if (req.session.user != undefined) {

        res.render("search", {
            username: username
        });
    } else {
        res.render("error", {
            error: "You need to be logged in to access this page."
        });
    }
});

app.post("/search/:mode", urlencodedParser, function (req, res) {
    var mode = req.params.mode;
    var input = req.body.search;
    var username = req.session.user;

    console.log(mode);
    if (mode == "isbn") {
        dbClient.query("SELECT * FROM booklist WHERE isbn LIKE $1", ['%' + input + '%'], function (dbError, dbResponse) {
            if (dbResponse.rows != 0) {


                res.render("searchlist", {
                    list: dbResponse.rows,
                    username: username
                });
            } else {
                res.render("search", {
                    search_error: "Search Error, please try a different input.",
                    username: username
                });
            }
        });
    } else if (mode == "author") {
        dbClient.query("SELECT * FROM booklist WHERE author LIKE $1", ['%' + input + '%'], function (dbError, dbResponse) {
            if (dbResponse.rows != 0) {


                res.render("searchlist", {
                    list: dbResponse.rows,
                    username: username
                });
            } else {
                res.render("search", {
                    search_error: "Search Error, please try a different input.",
                    username: username
                });
            }
        });
    } else {
        dbClient.query("SELECT * FROM booklist WHERE title LIKE $1", ['%' + input + '%'], function (dbError, dbResponse) {
            if (dbResponse.rows != 0) {


                res.render("searchlist", {
                    list: dbResponse.rows,
                    username: username
                });
            } else {
                res.render("search", {
                    search_error: "Search Error, please try a different input.",
                    username: username
                });
            }
        });
    }

});

app.get("/book/:isbn", urlencodedParser, function (req, res) {
    if (req.session.user != undefined) {

        var isbn = req.params.isbn;
        var avg = 0;
        var image;
        var username = req.session.user;

        dbClient.query("SELECT * FROM booklist WHERE isbn=$1", [isbn], function (dbError, dbResponse) {
            dbClient.query("SELECT * FROM reviewlist WHERE isbn=$1", [isbn], function (dbReviewError, dbReviewResponse) {

                var len = dbReviewResponse.rows.length;
                for (var i = 0; i < len; i++) {
                    avg += dbReviewResponse.rows[i].rating;
                }
                avg /= len;
                avg = Math.round(avg * 10) / 10;



                books.search(isbn, field = "isbn", function (error, results) { //returns array of "image-objects", but: search error, or some books don't have a thumbnail, or the isbn is different/can't be found    --> 3x if/else 

                    if (!error) {
                        if (results != undefined) {


                            console.log(results);

                            image = results[0].thumbnail;


                            if (image != undefined) {
                                res.render("book", {
                                    item: dbResponse.rows[0], //book itself
                                    review_list: dbReviewResponse.rows, //reviews
                                    avg: avg,
                                    image: image,
                                    username: username
                                });
                            } else {
                                res.render("book", {
                                    item: dbResponse.rows[0], //book itself
                                    review_list: dbReviewResponse.rows, //reviews
                                    avg: avg,
                                    image: "https://d1csarkz8obe9u.cloudfront.net/posterpreviews/book-cover-flyer-template-6bd8f9188465e443a5e161a7d0b3cf33_screen.jpg?ts=1456287935", //default image if thumbnail can't be found
                                    username: username
                                });
                            }
                        } else {
                            res.render("book", {
                                item: dbResponse.rows[0], //book itself
                                review_list: dbReviewResponse.rows, //reviews
                                avg: avg,
                                image: "https://d1csarkz8obe9u.cloudfront.net/posterpreviews/book-cover-flyer-template-6bd8f9188465e443a5e161a7d0b3cf33_screen.jpg?ts=1456287935", //default image if thumbnail can't be found
                                username: username
                            });
                        }
                    } else {
                        res.render("book", {
                            item: dbResponse.rows[0], //book itself
                            review_list: dbReviewResponse.rows, //reviews
                            avg: avg,
                            image: "https://d1csarkz8obe9u.cloudfront.net/posterpreviews/book-cover-flyer-template-6bd8f9188465e443a5e161a7d0b3cf33_screen.jpg?ts=1456287935", //default image if thumbnail can't be found
                            username: username
                        });
                    }
                });

            });
        });
    } else {
        res.render("error", {
            error: "You need to be logged in to access this page."
        });
    }

});

app.post("/book/:isbn", urlencodedParser, function (req, res) {
    var isbn = req.params.isbn;
    var text = req.body.textfield;
    var rating = req.body.rating;
    var id = req.session.userID;
    var avg = 0;
    var image;
    var review_error = false;
    var username = req.session.user;





    console.log(id);
    dbClient.query("INSERT INTO reviewlist (isbn, rating, text, user_id) VALUES ($1, $2, $3, $4)", [isbn, rating, text, id], function (dbError, dbResponse) {
        if (dbError) {
            if (rating == undefined) {
                review_error = "ERROR: Please submit a rating."
            } else {
                review_error = "ERROR: You already reviewed this book."; //Primary Key user_id, isbn --> Error when user tries to submit two reviews for one book
            }
        }
        dbClient.query("SELECT * FROM booklist WHERE isbn=$1", [isbn], function (dbError, dbResponse) {

            dbClient.query("SELECT * FROM reviewlist WHERE isbn=$1", [isbn], function (dbReviewError, dbReviewResponse) {

                var len = dbReviewResponse.rows.length;

                for (var i = 0; i < len; i++) {
                    avg += dbReviewResponse.rows[i].rating;
                }
                avg /= len;
                avg = Math.round(avg * 10) / 10;



                books.search(isbn, field = "isbn", function (error, results) { //returns array of "image-objects"
                    if (!error) {
                        image = results[0].thumbnail;

                        res.render("book", {
                            item: dbResponse.rows[0], //book itself
                            review_list: dbReviewResponse.rows, //reviews
                            avg: avg,
                            image: image,
                            review_error: review_error,
                            username: username
                        });
                    } else {
                        console.log(error);
                    }
                });

            });
        });
    });

});


app.listen(PORT, function () {
    console.log(`Shopping App listening on Port ${PORT}`);
});

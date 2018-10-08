var express = require('express');
var data = require('./processedData');
var config = require('./dbconfig');
const mongoose = require('mongoose');
var exphbs = require('express-handlebars');
var app = express();
var bodyParser = require('body-parser');
var env = "SIT";
const clientSessions = require("client-sessions");
var settings = require('./config');
var credMan = require('./credMan');
var fs = require('fs');

//Middlewares for various modules
app.use(express.static('public'));
app.use(express.static('views'));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.text({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.engine(".hbs", exphbs({
    extname: ".hbs",
    defaultLayout: 'layout',
    helpers: {
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        noteq: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars helper equal needs 2 parameters");
            if (lvalue == rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        json: function (context) {
            return JSON.stringify(context);
        }
    }
}));

// Setup client-sessions
app.use(clientSessions({
    cookieName: "session", // this is the object name that will be added to 'req'
    secret: "17gnirtselbasseugnugnolasisihtlol2018", // this is a long un-guessable string.
    duration: 5 * 60 * 1000, // duration of the session in milliseconds (5 minutes)
    activeDuration: 1000 * 60 // the session will be extended by this many ms each request (1 minute)
}));

//Middleware for ensuring login
function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

//MongoDB database connection
mongoose.connect(settings.dbConnectionStr);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    console.log('Connected To Mongo Database');
});

//sets the view engine to .hbs
app.set("view engine", ".hbs");

//application post is set to 5250
var PORT = process.env.port || 5250;

app.get('', function (req, res) {
    res.redirect('/' + env + '/home');
})

app.get('/:env/home', function (req, res) {
    console.info('GET  /home');
    env = req.params.env;
    config.searchData({}, env)
        .then((docs) => {
            if (req.session.user != undefined)
                res.render('home', { data: docs, env: env, user: req.session.user, show: "show" });
            else
                res.render('home', { data: docs, env: env, user: "hide", show: "show" });

        })
        .catch((err) => {
            if (req.session.user)
                res.render('home', { errMsg: err, env: env, user: req.session.user, show: "show" });
            else
                res.render('home', { errMsg: err, env: env, user: "hide", show: "show" });
        })
});

// Display the login html page
app.get("/login", function (req, res) {
    res.render("login", { env: env, user: "hide" });
});

// The login route that adds the user to the session
app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (username === "" || password === "") {
        // Render 'missing credentials'
        return res.render("login", { errorMsg: "Missing credentials." });
    }

    // use sample "user" (declared above)
    credMan.login(req.body)
        .then((name) => {
            req.session.user = {
                username: username,
                name: name,
                log: userLog(username, "User logged in!")
            };
            res.redirect('/');
        })
        .catch((err) => {
            res.render("login", { errorMsg: err });
        })

});

app.get('/signup', function (req, res) {
    req.session.reset();
    res.render('signup', { env: env, user: "hide" });
})

app.post('/signup', function (req, res) {
    credMan.signup(req.body)
        .then(() => {
            res.redirect('/login');
        })
        .catch((err) => {
            res.render('signup', { errorMsg: err, env: env, user: "hide" });
        })
})

// Log a user out by destroying their session
// and redirecting them to /login
app.get("/logout", function (req, res) {
    req.session.user.log += '\n' + userLog(req.session.user.username, "User logged out!");
    req.session.reset();
    res.redirect("/login");
});

app.post('/:env/addProcess', ensureLogin, function (req, res) {
    console.info('POST /addProcess');
    req.session.user.log += '\n' + userLog(req.session.user.username, "New Process added! '" + req.body.dataPoolProcess + "' process added with Process Code: '" + req.body.processCode + "' for envirenment(s): " + req.body.env);
    var args = req.body;
    var envArr = [];
    if (typeof (args.env) == "string") {
        envArr.push(args.env);
        args['env'] = envArr;
    }
    env = req.params.env;
    config.addProcess(args, env)
        .then((data) => {
            res.redirect('/' + env + '/home');
        })
        .catch((err) => {
            res.render('failedForm', { data: args, errMsg: err, env: env });
        })
})

app.post('/:env/editProcess', ensureLogin, function (req, res) {
    console.info('POST /editProcess');
    req.session.user.log += '\n' + userLog(req.session.user.username, "Process edited! Count for '" + req.body.dataPoolProcess + "' updated by: " + req.body.tcCount);
    env = req.params.env;
    config.editProcess(req.body, env)
        .then((data) => {
            res.redirect('/' + env + '/home');
        })
        .catch((err) => {
            res.render('home', { errMsg: err, user: req.session.user !== undefined ? req.session.user : {} });
        })
})

app.post('/addRecord', function (req, res) {
    console.info("POST /addRecord");
    var args = req.body;

    data.addData(args)
        .then((msg) => {
            res.status(200).send("Data added successfully!");
        })
        .catch((err) => {
            res.status(500).send("Unexpected error occurred!" + err);
        })
});

app.post('/search', function (req, res) {
    console.info("POST /search");
    var args = req.body;
    var searchQuery = {};
    searchQuery['processCode'] = args['processCode'];
    searchQuery['status'] = "new";
    searchQuery['env'] = args['env'];
    data.searchData(searchQuery)
        .then((data) => {
            if (args['type'] == "orgId")
                res.status(200).send(data.orgId);
            else if (args['type'] == "clientId")
                res.status(200).send(data.clientId);
        })
        .catch((err) => {
            res.status(404).send("Unexpected error occurred!" + err);
        })
})

app.post('/update', function (req, res) {
    console.info('POST /update');
    var args = req.body;
    var searchQuery = {};

    if (args['type'] == "orgId")
        searchQuery['orgId'] = args['data'];
    else if (args['type'] == "clientId")
        searchQuery['clientId'] = args['data'];
    else
        searchQuery = {};

    searchQuery['processCode'] = args['processCode'];

    data.update(searchQuery, args['status'])
        .then((data) => {
            res.status(200).send(data);
        })
        .catch((err) => {
            res.status(404).send("Unexpected error occurred! " + err);
        });
})

app.post('/getRecordCount', function (req, res) {
    console.info("POST /getRecordCount");
    var args = req.body;
    var searchQuery = {};
    var env = "";
    searchQuery['processCode'] = args['processCode'];
    env = args['env'];

    config.count(searchQuery, env)
        .then((data) => {
            res.status(200).send(data);
        })
        .catch((err) => {
            res.status(404).send(err);
        })
})

app.post('/addRecordData', function (req, res) {
    console.info("POST /addRecordData");
    config.addProcess(req.body)
        .then(() => {
            res.status(200).send("Data added successfully!");
        })
        .catch((err) => {
            res.status(500).send("Error occurred. Data not saved!" + err);
        })
})

app.post('/getExistingCount*', function (req, res) {
    if (req.params['0'] == "")
        console.info("POST /getExistingCount");
    var args = req.body;
    var searchQuery = {};
    searchQuery['processCode'] = args['processCode'];
    searchQuery['status'] = args['status'];
    searchQuery['env'] = args['env'];

    data.count(searchQuery)
        .then((data) => {
            res.status(200).send(data);
        })
        .catch((err) => {
            res.status(200).send('0');
        })
})

app.get('*', function (req, res) {
    res.render('NotFound', { env: "SIT2" });
});

//App listener
app.listen(PORT, function () {
    console.log('Application is now running on port: ' + PORT);
});

//Helper functions
function userLog(username, message) {
    var msg = new Date(Date.now()).toString().substr(0, 24) + ": " + username.toUpperCase() + ":  " + message;
    writeToLog(msg);
    return msg;
}

function writeToLog(logMessage) {
    var stream = fs.createWriteStream("./log.txt", { flags: 'a' });
    stream.write("\n" + logMessage);
    stream.end();
}
//////////////////////////////////////////////////
//                                              //
//      Main server for Chess Hub               //
//  http://www.github.com/macmorning/chess-hub  //
//                                              //
//////////////////////////////////////////////////
/*
*    Copyright (C) 2013
*	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
*	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var PORT = process.env.PORT || 8080;
var ADDRESS = process.env.IP;
var SERVERDIR = "";
if (process.env.C9_PID) {       // for running the server on c9.io
    SERVERDIR = process.env.HOME + '/' + process.env.C9_PID + '/server/';
}
var http = require('http'),
    url = require('url'),
    fs = require('fs');
var Channel = require('./channel.js');


var users = [];                                     // init the users array
var channels = [];                                  // init the channels array
channels['MAIN'] = new Channel('Main','MAIN');      // create the main chat channel
channels['MAIN'].messages.push({ time : currTime(), user : "ADMIN", msg : "Welcome to Chess Hub !", category : "chat_sys", to : ""  });
channels['MAIN'].switchOpen(true);                  // mark the main chat channel as open for all

channels['TESTA'] = new Channel('Test A','TEST A');
channels['TESTA'].gameLevel = 3;
channels['TESTA'].playerA= 'admin';


var MAXCLIENTS_2 = 70;          // absolute maximum number of clients; any request will be dropped once this number is reached
var MAXCLIENTS_1 = 50;          // maximum number of clients before refusing new connections
var MAXMESSAGES = 20;           // maximum number of messages sent at once

var LOGSTATIC = false;          // enable or disable static files serving logs
var LOGCONNECT = true;          // enable or disable connections logs
var LOGMESSAGING = true;        // enable or disable messaging logs
var LOGPOLLING = false;         // enable or disable polling logs
var LOGCHANNEL = true;          // enable or disable channel activity logs
var LOGSEARCHING = true;        // enable or disable game searches logs

function escapeHtml(unsafe) {
    if(unsafe) {// escapes Html characters
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    return false;
}

function sendMessage(from, msg, category, to ) {
    // adds a message to the messages array and send it to polling clients
    // sendMessage(from, msg, [category, [to]])
    // from : user issuing the message
    // msg : message
    // category : message category : 
    //        - chat_msg (by default), simple message sent to a chat channel or a user
    //        - chat_sys, system message to be broadcasted in all opened chat channels
    //        - chat_activity, chat channel activity : join, leave, quit
    //        - game, game channel activity
    // to : target for the message : a user, a game channel id, or main channel (by default)
    var message = [];
    if (!category) category = "chat_msg";
    message = {time: currTime(), user: from, msg: msg, category: category, to: to };
    LOGMESSAGING && console.log(currTime() + ' [MESSAG] ... sendMessage : ' + message.msg);
    channels[to].messages.push(message);
    var json = JSON.stringify( { counter: channels[to].messages.length, append: message });
    var i = 0;
    while(channels[to].clients.length > 0) {
        var client = channels[to].clients.pop();
        client.end(json);
        i++;
    }
    LOGMESSAGING && console.log(currTime() + ' [MESSAG] ... sent message to ' + i + ' client(s)');
}

function currTime() {
    // write current time in HH:mm format
    var currentDate = new Date();
    var hours = currentDate.getHours();
    if (hours < 10) hours = "0" + hours;
    var minutes = currentDate.getMinutes();
    if (minutes < 10) minutes = "0" + minutes;
    return(hours + ":" + minutes);
}


http.createServer(function (req, res) {

    if(channels['MAIN'].clients.length > MAXCLIENTS_2) {
          res.writeHead(500, { 'Content-type': 'text/txt'});
          res.end('Sorry, there are too many users right now ! Please try again later.');
    }

//
// ROUTING
//
   var url_parts = url.parse(req.url);
   //console.log(url_parts);

//
// CONNECTION SERVICE
//
    if(url_parts.pathname.substr(0, 8) == '/connect') {
        LOGCONNECT && console.log(currTime() + ' [CONNEC] connect');
        if(channels['MAIN'].clients.length > MAXCLIENTS_1) {
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify( {
                    returncode: 'ko',
                    returnmessage: 'Sorry, there are too many users right now. Please try again in a few minutes.',
                    user: user
                }));
        }
        var user = "";
        var data = "";
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            var json = JSON.parse(data);
            user = escapeHtml(json.user);
            LOGCONNECT && console.log(currTime() + ' [CONNEC] ... connect ' + user);

            if (users.indexOf(user) == -1) {
                console.log(currTime() + ' [CONNEC] user: ' + user + ' connected, client: ' + json.clientLib + ', version: ' + json.clientVersion);
                users.push(user);
                res.writeHead(200, { 'Content-type': 'application/json'});
                res.end(JSON.stringify( {
                    returncode: 'ok',
                    returnmessage: 'Welcome ' + user,
                    user: user,
                    key: 'unique key for ' + user     // TODO : generate a GUID here
                }));
            } else {
                LOGCONNECT && console.log(currTime() + ' [CONNEC] ... ' + user + ' is already reserved');
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify( {
                    returncode: 'ko',
                    returnmessage: 'Sorry, ' + user + ' is already used. Please pick another name.',
                    user: user
                }));
            }
            LOGCONNECT && console.log(currTime() + ' [CONNEC] ... current users : ' + users);
        });
    } 

//
// DISCONNECTION SERVICE
//
    else if(url_parts.pathname.substr(0, 11) == '/disconnect') {
        LOGCONNECT && console.log(currTime() + ' [CONNEC] disconnect');
        var user = "";
        var data = "";
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            var json = JSON.parse(data);
            user = escapeHtml(json.user);
            LOGCONNECT && console.log(currTime() + ' [CONNEC] ... disconnect user ' + user);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify([]));
            users.splice(users.indexOf(user),1);
        });
    }
    
//
// POLLING SERVICE
//
    else if(url_parts.pathname.substr(0, 5) == '/poll') {
        // polling
        var data="";
        var channel="";
        var user = "";
        var key = "";
        var counter = 0;
        LOGPOLLING && console.log(currTime() + ' [POLLIN] polling')
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            var json = JSON.parse(data);
            channel = escapeHtml(json.channel);
            user = escapeHtml(json.user);
            key = escapeHtml(json.key);
            counter = json.counter;
            if (isNaN(counter) || !channel)  {   // no counter provided or no channel id, send Bad Request HTTP code
                LOGPOLLING && console.log(currTime() + ' [POLLIN] ... error, dumping data below')
                LOGPOLLING && console.log(json)
                res.writeHead(400, { 'Content-type': 'text/txt'});
                res.end('Bad request');
            }
            LOGPOLLING && console.log(currTime() + ' [POLLIN] ... counter = ' + counter + ' from user = ' + user + ' for channel = ' + channel);
            res.writeHead(200, {'Content-Type': 'application/json'});
            var n = channels[channel].messages.length - counter;
            if(n > 0) {
                var lastMessages = {};
                if ( n <= MAXMESSAGES ) {
                    lastMessages = channels[channel].messages.slice(counter)
                } else if ( n > MAXMESSAGES ) {       // if there are too many messages to send
                    lastMessages = channels[channel].messages.slice(messages.length - MAXMESSAGES);
                }
                LOGPOLLING && console.log(currTime() + ' [POLLIN] ... sending ' + lastMessages.length + ' new message(s)');
                res.writeHead(200, { 'Content-type': 'application/json'});
                res.end(JSON.stringify( {
                    counter: channels[channel].messages.length,
                    append: lastMessages
                }));
            } else {
                channels[channel].clients.push(res);  // if there is no message to push, keep the client in the clients array (long polling)
            }
        });
    } 

//
// SEARCH GAME SERVICE
//
    else if(url_parts.pathname.substr(0, 11) == '/searchGame') {
        var player="";
        var playerLevel=0;
        var playerAcceptLower=0;
        var playerAcceptHigher=0;
        var data="";
        LOGSEARCHING && console.log(currTime() + ' [SEARCH] search a game')
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            try { var json = JSON.parse(data); }
            catch(err) { console.log(err); console.log(data); var json= {};}
            player = escapeHtml(json.user);
            playerLevel = json.playerLevel;
            playerAcceptLower = json.playerAcceptLower;
            playerAcceptHigher = json.playerAcceptHigher;
            if (!player || isNaN(playerLevel))  {   // no username, no level => send Bad Request HTTP code
                LOGSEARCHING && console.log(currTime() + ' [SEARCH] ... error, dumping data below')
                LOGSEARCHING && console.log(json)
                res.writeHead(400, { 'Content-type': 'text/txt'});
                res.end('Bad request');
                return 1;
            }
            LOGSEARCHING && console.log(currTime() + ' [SEARCH] ... for player = ' + player + ', level = ' + playerLevel);
            
            // searching for an existing game
            for (var i in channels) {
                var channel = channels[i];
                if(channel.playerA && !channel.playerB      // this is a game channel with only a player A
                        && (playerAcceptLower || channel.gameLevel >= playerLevel - 1)
                        && (playerAcceptHigher || channel.gameLevel <= playerLevel + 1)) {
                    LOGSEARCHING && console.log(currTime() + ' [SEARCH] ... found a game ! name = ' + channel.name + ', playerA = ' + channel.playerA);
                    channel.addUser(player);
                    channel.playerB = player;
                    LOGSEARCHING && console.log(currTime() + ' [SEARCH] ... playerB = ' + channel.playerB);
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify( {
                            returncode: 'ok',
                            returnmessage: 'game found',
                        }));
                }
            };
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify( {
                    returncode: 'ko',
                    returnmessage: 'No game found',
                }));      // TODO : enable a long polling for games
        });
    } 
    
//
// INBOUND MESSAGES SERVICE
//
    else if(url_parts.pathname.substr(0, 4) == '/msg') {
        // message receiving via JSON POST request
        // user : user issuing the messages
        // key : user's key
        // channel : channel to dispatch the message to
        // category : message category; either chat_msg or game
        // msg : message
        LOGMESSAGING && console.log(currTime() + ' [MESSAG] new message');
        var user = "";
        var msg = "";
        var channel = "";
        var data = "";
        var category = "";
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            try { var json = JSON.parse(data); }
            catch(err) { console.log(err); console.log(data); var json= {};}
            msg = escapeHtml(json.msg);         // escaping html chars
            user = escapeHtml(json.user);
            category = escapeHtml(json.category) || 'chat_msg' ;        // default : chat message
            channel = escapeHtml(json.channel) || 'MAIN';                  // default : main channel
            
            LOGMESSAGING && console.log(currTime() + ' [MESSAG] ... msg = ' + msg + " / user = " + user + " / channel = " + channel + " / category = " + category);
            sendMessage(user, msg, category, channel);
            res.writeHead(200, { 'Content-type': 'text/html'});
            res.end(JSON.stringify({0:'OK'}));
        });
    }
    
//
// ADMIN SERVICE
//
    else if(url_parts.pathname.substr(0) == '/admin') {
        console.log(currTime() + ' [ADMIN ] dumping objects to console');
        console.log(currTime() + ' [ADMIN ] ... users');
        console.log(users);
        //console.log(currTime() + ' [ADMIN ] ... clients');
        //console.log(clients);
        console.log(currTime() + ' [ADMIN ] ... messages');
        console.log(messages);
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(currTime() + ' Objects dumped to console');
    }

//
// STATIC FILES SERVING
//
    else {
        // file serving
        LOGSTATIC && console.log(currTime() + ' [STATIC] client file request');
        var file='';
        if(url_parts.pathname == '/' || url_parts.pathname == '/client' || url_parts.pathname == '/client/') {
            file = 'main.html';
        }  else if(url_parts.pathname.substr(0, 8) == '/favicon') {
            // serving the favicon
            file = 'img/favicon.ico';
        }  else {
            if(url_parts.pathname.substr(0,7) == "/client") {   // remove the potential "/client" reference
                file = escapeHtml(url_parts.pathname.substr(8)); 
            } else {
                file = escapeHtml(url_parts.pathname); 
            }
        }
        LOGSTATIC && console.log(currTime() + ' [STATIC] ... serving ../client/' + file);
        fs.readFile(SERVERDIR+'../client/'+file, function(err, data) {
            if(err) {
                console.log(currTime() + ' [STATIC] ... ' + err);
                if(err.code == "ENOENT") {      // file is simply missing
                    res.writeHead(404, { 'Content-type': 'text/txt'});
                    res.end('file not found');
                } else {                        // other error; could be EACCES or anything
                    res.writeHead(503, { 'Content-type': 'text/txt'});
                    res.end('Unhandled server error (' + err.code + ')');
                }
            }
            res.end(data);
        });
    } 


}).listen(PORT,ADDRESS);
console.log(currTime() + ' [START ] Server running on port ' + PORT);

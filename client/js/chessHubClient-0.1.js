/*
*    Copyright (C) 2013
*	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
*	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/*
*   
*
*
*/
;CHESSHUB = {
	name: 'chessHubClient', // client name
	version: '0.1',         // client lib version
    user: '',               // user name
    key:'',                 // unique key provided at login time
    channels:[],            // list of polled channels; each channel is an object : { counter: last message count, name : display name, history: messages history }
    ajaxPoll: {},         // references the current polling ajax call
    ajaxSearchGame: {},     // references the current search game ajax call

    //
    //  function : init()
    //  initialize the CHESSHUB namespace
    //
    init: function() {
        if(CHESSHUB.user) {
            CHESSHUB.disconnect(function(){
                    // nothing to do
                },
                function() {
                    //nothing to do
                } );
        }
        CHESSHUB._abortAjaxCalls();
        CHESSHUB.user = '';
        CHESSHUB.key = '';
        CHESSHUB.channels = [];
    },

    //
    //  private function : _stopPoll()
    //  attempts to stop the current ajaxPoll
    //
    _abortAjaxCalls: function() {
        try { ajaxPoll.abort(); }  // try to abort latest ajax polling request
            catch(err) { }     // if no polling has to be aborted
        try { ajaxSearchGame.abort(); }  // try to abort latest ajax polling request
            catch(err) { }     // if no polling has to be aborted
    },

    //
    //  private function : _poll()
    //  recursive long polling function
    //
    _poll: function(channel) {
        if(CHESSHUB.channels[channel].counter.isNaN)
        {
            console.log('CHESSHUB._poll : ' + channel + ' is not a known channel');
            return false;
        }
        console.log('polling ... ' + CHESSHUB.channels[channel].counter);
        var data = { user: CHESSHUB.user, key: CHESSHUB.key, counter: CHESSHUB.channels[channel].counter, channel: channel } ;
        ajaxPoll = $.ajax({
            type: 'POST',
            url : '/poll',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            data: JSON.stringify(data),
            success: function (response) {              // jquery automatically parses the json answer
                if (isNaN(response.counter)) {
                    console.log('CHESSHUB._poll : error - unexpected answer');
                    console.log(response);
                } else {
                    CHESSHUB.channels[channel].counter = response.counter;
                }
                if($.isArray(response.append)) { 
                    response.append.forEach(function(message) { addMessage(message); });
                } else {
                    addMessage(response.append);
                }
                CHESSHUB._poll(channel);
            },
            error: function(data,status,error) {
                    // the error event can be triggered because the node server is down (status = error)
                    // or if the request is aborted (status = abort)
                    console.log('CHESSHUB._poll : error - ' + status);
                    console.log(error);
                    if (status == 'error') {
                        setTimeout(function() {CHESSHUB._poll(channel);},10000); // retry after 10 seconds
                    }
            }
        });
    },

    //
    //  function : listUsers(channel)
    //  queries the server for the users list for the specified channel
    //
    listUsers: function(channel) {
        console.log('CHESSHUB.listUsers');
    },

    //
    //  function : searchGame(playerLevel,playerAcceptLower,playerAcceptHigher)
    //  asks for a game
    //
    searchGame: function(playerLevel,playerAcceptLower,playerAcceptHigher,successCallBack,errorCallBack) {
        console.log('CHESSHUB.searchGame');
        var data = {};
        data = { user: CHESSHUB.user, key: CHESSHUB.key, playerLevel: playerLevel, playerAcceptLower: playerAcceptLower, playerAcceptHigher: playerAcceptHigher } ;
        console.log(data);
        ajaxSearchGame = $.ajax({
            type: 'POST',
            url : '/searchGame',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            data: JSON.stringify(data),
            success: function (response) {              // jquery automatically parses the json answer
                    console.log('CHESSHUB.searchGame : answer : ');
                    console.log(response);
                    successCallBack(response);
            },
            error: function(data,status,error) {
                    // the error event can be triggered because the node server is down (status = error)
                    // or if the request is aborted (status = abort)
                    console.log('CHESSHUB.searchGame : error - ' + status);
                    console.log(error);
                    errorCallBack();
            }
        });
    },

    //
    //  function : listen(channel)
    //  starts polling for the specified channel
    //
    listen: function(channel) {
        console.log('CHESSHUB.listen : adding ' + channel + ' to the channels list : ');
        CHESSHUB.channels[channel] = { counter : 0, name : channel, history : [] };
        console.log(CHESSHUB.channels[channel]);
        this._poll(channel);
    },

    //
    //  function : leave(channel)
    //  stops polling for the specified channel
    //
    leave: function(channel) {
        CHESSHUB.channels[channel] = {};
    },

    //
    //  function : connect(user, successCallBack, errorCallBack)
    //  connects a user to the chesshub server
    //
    connect: function(user, successCallBack, errorCallBack) {
            CHESSHUB.init();
            var data = { user: user, clientLib: CHESSHUB.name, clientVersion: CHESSHUB.version } ;
            $.ajax({
                type: 'POST',
                url : '/connect',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                data: JSON.stringify(data),
                success: function (response) { 
                        if (response.returncode == 'ok') {
                            CHESSHUB.user = response.user;
                            CHESSHUB.key = response.key;
                        }
                        successCallBack(response);
                    },
                error: function(data,status,error) {
                        console.log('CHESSHUB.connect error - ' + status);
                        console.log(error);
                        errorCallBack();
                    }
             });
    },

    //
    //  function : disconnect()
    //  disconnects a user from to the chesshub server
    //
    disconnect: function() {
            if (!CHESSHUB.user) {
                return false;
            }
            var data = { user: CHESSHUB.user, key: CHESSHUB.key } ;
            console.log('CHESSHUB.disconnect : leaving all channels');
            CHESSHUB.channels = [];
            $.ajax({
                type: 'POST',
                url : '/disconnect',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                data: JSON.stringify(data),
                success: function () { 
                        console.log('CHESSHUB.disconnect : ... ok');
                    },
                error: function(data,status,error) {
                        console.log('CHESSHUB.disconnect error - ' + status);
                        console.log(error);
                    }
             });
    },
 
    //
    //  function : sendMessage(context, text, successCallBack, errorCallBack)
    //  
    //
    sendMessage: function (text, channel, successCallBack, errorCallBack) {
        if(!CHESSHUB.user) {
            console.log('CHESSHUB.sendMessage error - Not connected');
            return;
        }
        var data = { user: CHESSHUB.user, channel: channel, key: CHESSHUB.key, msg: text } ;
        $.ajax({
            type: 'POST',
            url : '/msg',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            data: JSON.stringify(data),
            success: function() { successCallBack(); },
            error: function(data,status,error) { 
                console.log('CHESSHUB.sendMessage error - ' + status);
                console.log(error);
                errorCallBack(); 
            }
         });
    }
}

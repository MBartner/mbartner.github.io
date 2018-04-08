var socket;
var isConnected = false;
var state = 0; // 0: Not connected, 1: joining, 2: joined, 3: try hosting, 4: hosting
var sessionName;
var sessionNameLen = 0;

var hostCallback;
var joinCallback;
var updateCallback;
var leaveCallback;

function connect(callback){
	socket = new WebSocket('ws://127.0.0.1:3000');

	socket.onopen = function () {
		isConnected = true;
		callback();
	};

	socket.onclose = function () {
		isConnected = false;
		state = 0;
	};

	socket.onerror = function (err) {
		console.log('WebSocket Error ' + err);
	};

	socket.onmessage = function (e) {
		console.log(e.data);
		processData(e.data);
	};
}

function disconnect(){
	if(socket.readyState === WebSocket.OPEN){
		socket.close();
	}
	isConnected = false;
	state = 0;
	sessionName = null;
	sessionNameLen = 0;
	return 0;
}

function host(sessionName, callbackHost){
	console.log("host()");
	if(sessionName.length === 0 || sessionName.length > 255){
		return 1;
	}
	if(!isConnected){
		return 2;
	}
	if(state > 0){
		return 3;
	}
	sessionNameLen = sessionName.length;
	len = sessionNameLen + 1;
	state = 3;
	socket.send("\x01" + intToByteString(len) + "\x01" + String.fromCharCode(sessionNameLen) + sessionName);
	hostCallback = callbackHost;
	return 0;
}

// Return- 0:success 1: Invalid session name. 2: Not connected. 3:Already in session.
function join(sessionName, callbackJoin, callbackUpdate){
	console.log("join()");
	if(sessionName.length === 0 || sessionName.length > 255){
		return 1;
	}
	if(!isConnected){
		return 2;
	}

	if(state > 0){
		return 3;
	}
	sessionNameLen = sessionName.length;
	len = sessionNameLen + 1;
	socket.send("\x01" + intToByteString(len) + "\x02" + String.fromCharCode(sessionNameLen) + sessionName);
	state = 1;
	joinCallback = callbackJoin;
	updateCallback = callbackUpdate;
	return 0;
}

// Return- 0:success, 1: Not connected, 2: Not hosting
function sendUpdate(type, x, y, z){
	console.log("sendUpdate()");
	if(!isConnected){
		return 1;
	}
	if(state != 4){
		return 2;
	}
	var len = (x).toString().length + (y).toString().length + (z).toString().length + 4;
	socket.send("\x01" + intToByteString(len)+ "\x03" + String.fromCharCode(type) + String.fromCharCode((x).toString().length) + (x).toString() + String.fromCharCode((y).toString().length) + (y).toString()+ String.fromCharCode((z).toString().length) + (z).toString());
	return 0;
}

// Return- 0:success 1: Not connected. 2: Not in session.
function leave(){
	console.log("leave()");
	if(!isConnected){
		return 1;
	}
	if(state != 2){
		return 2;
	}

	socket.send("\x01" + intToByteString(len) + "\x04" + String.fromCharCode(sessionNameLen) + sessionName);
	return 0;
}

function intToByteString(n){
	return String.fromCharCode((n >> 24) & 0xFF) + String.fromCharCode((n >> 16) & 0xFF) + String.fromCharCode((n >> 8) & 0xFF) + String.fromCharCode(n & 0xFF);
}

function processData(data){
	if(data.length < 6){
		console.error("processData(): Invalid length message.");
		return;
	}
	if(data.charCodeAt(0) != 0x01){
		console.error("processData(): Invalid version ID.");
		return;
	}

	var len = (data.charCodeAt(1) << 24) + (data.charCodeAt(2) << 16) +  (data.charCodeAt(3) << 8) + data.charCodeAt(4);
	if(len != data.substring(6).length){
		console.error("processData(): Invalid length.");
		return;
	}
	var command = data.charCodeAt(5);

	if(command == 0x10){
		handleHost(len, data.substring(6));
	}
	else if(command == 0x20){
		handleJoin(len, data.substring(6));
	}
	else if(command == 0x30){
		handleUpdate(len, data.substring(6));
	}
	else if(command == 0x40){
		handleLeave(len, data.substring(6));
	}
	else{
		console.error("processData(): Invalid command.");
	}
}

function handleHost(len, data){
	console.log("handleHost()");
	if(!(len == 1 || len == 2)){
		console.error("handleHost(): Invalid message length.");
		return;
	}

	if(len == 1){
		state = 4;
		hostCallback(0);
	}
	else{
		state = 0;
		hostCallback(data.charCodeAt(1));
	}
}

function handleJoin(len, data){
	console.log("handleJoin()");
	if(!(len == 1 || len == 2)){
		console.error("handleJoin(): Invalid message length.");
		return;
	}

	if(len == 1){ // Success
		state = 2;
		joinCallback(0);
	}
	else{
		state = 0;
		joinCallback(data.charCodeAt(1));
	}
}

function handleUpdate(len, data){
	console.log("handleUpdate()");
	var type = data.charCodeAt(0);
	var currIndex = 2;
	var xLen = data.charCodeAt(1);
	console.log("xLen: " + xLen);
	var x = data.substring(currIndex, currIndex + xLen);
	var yLen = data.charCodeAt(currIndex + xLen);
	currIndex = currIndex + xLen + 1;
	var y = data.substring(currIndex, currIndex + yLen);
	var zLen = data.charCodeAt(currIndex + yLen);
	currIndex = currIndex + yLen + 1;
	var z = data.substring(currIndex, currIndex + zLen);
	updateCallback(type, Number(x), Number(y), Number(z));
}

function handleLeave(len, data){
	if(!(len == 1 || len == 2)){
		console.error("handleJoin(): Invalid message length.");
		return;
	}

	if(len == 1){
		state = 0;
		leaveCallback(0);
	}
	else{
		leaveCallback(data.charCodeAt(1));
	}
}

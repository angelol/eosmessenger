// webrtc code inspired by https://jameshfisher.com/2017/01/16/tiny-serverless-webrtc.html

var RTCPeerConnection;
var peerConn;
var dataChannel;
var user = {};
var sessions = {};
var dev = false;
$(function() {
    init();
});


function init() {

    if(dev) {
        user.username = getCookie("username");
        user.pk = getCookie("pk");
    }

  if(!logged_in()) {
    console.log("Not logged in");
    show_login();
  }
  eos = Eos.Localnet({keyProvider: [user.pk], httpEndpoint: httpEndpoint});

  RTCPeerConnection = window.RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
  peerConn = new RTCPeerConnection({'iceServers': [{'urls': ['stun:stun.l.google.com:19302']}]});

  $("form.recipient").submit(create);
  $("form.message").submit(send);

  poll();
}

function show_login() {
  if(!user.username) {
    user.username = prompt("Please enter your EOS account name");
  }
  user.pk = prompt("Please enter your EOS private key");



  if(dev && user.username && user.pk) {
      setCookie("username", user.username, 30);
      setCookie("pk", user.pk, 30);
  }
}

function logged_in() {
  return !!user.username;
}

var xxx;
function poll() {
  eos.getTableRows({json:true, scope: contract, code: contract,  table: 'offer', table_key: user.username, limit:100}).then(res => {
    xxx = res;
    if(res.rows.length > 0) {
      let row = get_row_by_recipient(res.rows, user.username);
      if(row) {
        console.log(row);
        if(row.type == 'offer') {
          var session = new Session();
          sessions[session.recipient] = session;
          session.start(row.creator);
          session.acceptOffer(row);
        } else if(row.type == 'answer') {
          var session = sessions[row.creator];
          if(!session) {
              var session = new Session();
              session.start(row.creator);
              sessions[session.recipient] = session;
          }
          session.gotAnswer(row);
        }

      }



    }

  });

  window.setTimeout(poll, 1000);
}

function send(event) {
  event.preventDefault();
  let x = $("input[name=message]");
  say(x.val());
  x.val('');
}

function message_received(x) {
    console.log('message_received Got message:', x.data);
    $(".chatlog").append("<p class=\"theirs\">" + x.data + "</p>");
    scrollSmoothToBottom(".chatlog");
}

function send_message(msg) {
    console.log("send_message: " + msg);
    dataChannel.send(msg);
    $(".chatlog").append("<p class=\"ours\">" + msg + "</p>");
    scrollSmoothToBottom(".chatlog");
    
}

function create(event) {
  event.preventDefault();

  console.log("Creating ...");
  var session = new Session();
  session.start($("input[name=recipient]").val());
  sessions[session.recipient] = session;

  dataChannel = peerConn.createDataChannel('test');
  dataChannel.onopen = (e) => {
    window.say = send_message;
    console.log('Say things with say("hi")');
  };
  dataChannel.onmessage = message_received;
  peerConn.createOffer({})
    .then((desc) => peerConn.setLocalDescription(desc))
    .then(() => {})
    .catch((err) => console.error(err));
  peerConn.onicecandidate = (e) => {
    if (e.candidate == null) {
      // send peerConn.localDescription to EOS
      session.sendOffer(peerConn.localDescription);
      console.log("Get joiners to call: ", "join(", JSON.stringify(peerConn.localDescription), ")");


    }
  };
  window.gotAnswer = (answer) => {
    console.log("Initializing ...");
    peerConn.setRemoteDescription(new RTCSessionDescription(answer));
  };
}

function join(offer, recipient) {
  console.log("Joining ...");

  peerConn.ondatachannel = (e) => {
    dataChannel = e.channel;
    dataChannel.onopen = (e) => {
      window.say = send_message;
      console.log('Say things with say("hi")');
    };
    dataChannel.onmessage = message_received;
  };

  peerConn.onicecandidate = (e) => {
    if (e.candidate == null) {
      console.log("Get the creator to call: gotAnswer(", JSON.stringify(peerConn.localDescription), ")");
      var session = new Session();
      session.start(recipient);
      session.sendAnswer(JSON.stringify(peerConn.localDescription), recipient);
    }
  };

  var offerDesc = new RTCSessionDescription(offer);
  peerConn.setRemoteDescription(offerDesc);
  peerConn.createAnswer({})
    .then((answerDesc) => peerConn.setLocalDescription(answerDesc))
    .catch((err) => console.warn("Couldn't create answer"));
}


function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function get_row_by_recipient(rows, recipient) {
    for (var i in rows) {
        if(rows[i].recipient == recipient) {
            return rows[i];
        }
    }
}

function scrollSmoothToBottom (id) {
   var div = $(id);
   div.animate({
      scrollTop: div.prop("scrollHeight") - div.prop("clientHeight")
   }, 500);
}

function Session() {
  var self = this;
  var recipient;
  var state;

  self.start = function (recipient) {
    self.recipient = recipient;
  };

  self.sendOffer = function(offer) {
      console.log("sendOffer user.username=" + user.username + " self.recipient=" + self.recipient);
    eos.transaction({
    actions: [
      {
        account: contract,
        name: 'addoffer',
        authorization: [{
          actor: user.username,
          permission: 'active'
        }],
        data: {
          "type": "offer",
          "description": JSON.stringify(offer),
          "sender": user.username,
          "recipient": self.recipient,
          "nonce": "0",
          "checksum": "0"
        }
      }
    ]
    }).then(x => {
      console.log("Done!");
    });
  };

  self.acceptOffer = function(offer) {
      console.log("Ohai acceptOffer offer=" + JSON.stringify(offer) + " sender=" + offer.creator);
      console.log("Offer.id=" + offer.id);
    eos.transaction({
    actions: [
      {
        account: contract,
        name: 'acceptoffer',
        authorization: [{
          actor: user.username,
          permission: 'active'
        }],
        data: {
            "sender": user.username,
            "id": offer.id
        }
      }
    ]
    }).then(x => {
      console.log("Done! " + offer);
      join(JSON.parse(offer.description), offer.creator);
    });
  };

  self.sendAnswer = function(offer, recipient) {
    eos.transaction({
    actions: [
      {
        account: contract,
        name: 'addoffer',
        authorization: [{
          actor: user.username,
          permission: 'active'
        }],
        data: {
          "type": "answer",
          "description": offer,
          "sender": user.username,
          "recipient": recipient,
          "nonce": "0",
          "checksum": "0"
        }
      }
    ]
    }).then(x => {
      console.log("Done!");
    });
  }

  self.gotAnswer = function(offer) {
      console.log("gotAnswer offer.id="+offer.id);
    eos.transaction({
    actions: [
      {
        account: contract,
        name: 'acceptoffer',
        authorization: [{
          actor: user.username,
          permission: 'active'
        }],
        data: {
          "sender": user.username,
          "id": offer.id
        }
      }
    ]
    }).then(x => {
      console.log("Done! " + offer);
      gotAnswer(JSON.parse(offer.description));
    });
  }



}

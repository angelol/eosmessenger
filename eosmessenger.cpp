#include <eosiolib/eosio.hpp>
#include <eosiolib/print.hpp>

using namespace eosio;
using namespace std;

class eosmessenger : public contract {
    using contract::contract;

    public:
        const uint32_t FIVE_MINUTES = 5*60;
        const uint32_t THREE_DAYS = 60*60*24*3;

        eosmessenger(account_name self)
        :contract(self),
        offers(_self, _self),
        whitelists(_self, _self),
        messages(_self, _self)
        {}

        /* **********************
         * Methods for WebRTC Signalling
         * online peer to peer messages, not stored in chain
         * only works while both users are online
         * **********************/

        //@abi action
        void addoffer(const string type, const string description, const account_name sender, const account_name recipient, const string nonce, const string checksum) {
          require_auth(sender);

          auto itr = offers.emplace(sender, [&](auto& offer) {
              offer.id = offers.available_primary_key();
              offer.expires_at = now() + FIVE_MINUTES;
              offer.description = description;
              offer.creator = sender;
              offer.recipient = recipient;
              offer.type = type;
              offer.nonce = nonce;
              offer.checksum = checksum;
          });
        };

        void acceptoffer(const account_name sender, const uint64_t id) {
          require_auth(sender);
          // once use has accepted the offer, it can be safely deleted
          // since we're only using this to initiate the webrtc session
          auto item = offers.get(id);
          eosio_assert(item.recipient == sender, "Not authorized");
          offers.erase(offers.find(item.id));
        };

        //@abi action
        void clearexpired(const account_name sender) {
          std::vector<offer> l;

          // check which objects need to be deleted
          for( const auto& item : offers ) {
            if(now() > item.expires_at) {
              l.push_back(item);
            }

          }

          // delete in second pass
          for (offer item : l) {
            offers.erase(offers.find(item.primary_key()));
          }
        };


    /* **********************
     * Methods for offline messages
     * (on-chain, encrypted)
     * supports offline messages with an expiry date
     * is stored in blockchain forever for documentation purposes
     * optionally encrypted.
     * **********************/

      void send(const account_name from, const account_name to, const string text) {
        require_auth(from);
        messages.emplace(from, [&](auto& x) {
          x.id = messages.available_primary_key();
          x.from = from;
          x.to = to;
          x.text = text;
          x.expires_at = now() + THREE_DAYS;
        });

      };

      void markread(account_name to, uint64_t id) {
        require_auth(to);
        messages.erase(messages.find(id));
      };

      //@abi action
      void clearmess(const account_name sender) {
          print("clearmess ");
        // auto exp_idx = messages.template get_index<N(expires_at)>();
        // auto itr = exp_idx.lower_bound(now());
        // exp_idx.erase(itr);

      };

    private:
        // @abi table offer i64
        struct offer {
            uint64_t id;
            uint64_t expires_at; // allows us to delete expired offers to free up RAM
            account_name creator;
            account_name recipient;
            string type; // "offer" or "answer"

            // this is encrypted with the recipient's public key, that's why we need nonce and checksum
            string description;
            string nonce;
            string checksum;

            uint64_t primary_key()const { return id; }
            uint64_t get_recipient()const { return recipient; }
            uint64_t get_expires_at()const { return expires_at; }

            EOSLIB_SERIALIZE(offer, (id)(expires_at)(creator)(recipient)(type)(description)(nonce)(checksum));
        };
        typedef multi_index<N(offer), offer,
         indexed_by< N(by_recipient), const_mem_fun<offer, uint64_t, &offer::get_recipient> >,
         indexed_by< N(expires_at), const_mem_fun<offer, uint64_t, &offer::get_expires_at> >
        > offer_index;
        offer_index offers;

        // @abi table whitelist i64
        struct whitelist {
          uint64_t id;
          account_name user;
          account_name whitelisted;

          uint64_t primary_key()const { return id; }
          EOSLIB_SERIALIZE(whitelist, (id)(user)(whitelisted));
        };
        typedef multi_index<N(whitelist), whitelist> whitelist_index;
        whitelist_index whitelists;

        // @abi table message i64
        struct message {
          uint64_t id;
          account_name from;
          account_name to;

          // if to doesn't read this message, this allows us to clear memory from RAM
          time expires_at;

          // text is encrypted with the recipient's public key, that's why we need nonce and checksum
          string text;
          string nonce;
          string checksum;

          uint64_t primary_key()const { return id; }
          uint64_t get_expires_at()const { return expires_at; }
          EOSLIB_SERIALIZE(message, (id)(from)(to)(expires_at)(text)(nonce)(checksum));
        };
        typedef multi_index<N(message), message,
          indexed_by< N(expires_at), const_mem_fun<message, uint64_t, &message::get_expires_at> >
        > message_index;
        message_index messages;

};
EOSIO_ABI(eosmessenger, (addoffer)(acceptoffer)(clearexpired)(clearmess));

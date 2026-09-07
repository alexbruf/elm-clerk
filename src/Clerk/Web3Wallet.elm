module Clerk.Web3Wallet exposing (Web3Wallet, decoder)

{-| The Clerk web3 wallet resource, one entry of `Clerk.User`'s
`web3Wallets`.

@docs Web3Wallet, decoder

-}

import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder)


{-| One of a user's web3 wallets. `web3Wallet` is the wallet address.
-}
type alias Web3Wallet =
    { id : String
    , web3Wallet : String
    , verification : Verification
    }


{-| Decode a `Web3Wallet` from the JSON the shim sends.

    { "id": "idn_3"
    , "web3Wallet": "0x0000000000000000000000000000000000000001"
    , "verification": Verification
    }

-}
decoder : Decoder Web3Wallet
decoder =
    Decode.map3 Web3Wallet
        (Decode.field "id" Decode.string)
        (Decode.field "web3Wallet" Decode.string)
        (Decode.field "verification" Verification.decoder)

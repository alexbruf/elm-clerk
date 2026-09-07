module Clerk.Passkey exposing (Passkey, decoder)

{-| The Clerk passkey resource, one entry of `Clerk.User`'s `passkeys`.

@docs Passkey, decoder

-}

import Clerk.Internal.Protocol as Protocol
import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder)
import Time


{-| One of a user's registered passkeys.

The WebAuthn `publicKey` of the verification is browser-only and is
deliberately not serialized.

-}
type alias Passkey =
    { id : String
    , name : Maybe String
    , lastUsedAt : Maybe Time.Posix
    , verification : Maybe Verification
    }


{-| Decode a `Passkey` from the JSON the shim sends.

    { "id": "passkey_1"
    , "name": "MacBook"
    , "lastUsedAt": 1700000000000
    , "verification": Verification
    }

`lastUsedAt` arrives as epoch milliseconds and accepts `null`.

-}
decoder : Decoder Passkey
decoder =
    Decode.map4 Passkey
        (Decode.field "id" Decode.string)
        (Decode.field "name" (Decode.nullable Decode.string))
        (Decode.field "lastUsedAt" (Decode.nullable Protocol.posixMillis))
        (Decode.field "verification" (Decode.nullable Verification.decoder))

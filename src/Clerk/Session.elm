module Clerk.Session exposing (Session, decoder)

{-| The Clerk session resource, reduced to the fields listed in
`coverage.json`.

The session token is deliberately absent: tokens are only available through
`Clerk.requestToken`, which round-trips to ClerkJS so the token is always
fresh.

@docs Session, decoder

-}

import Clerk.Internal.Protocol as Protocol
import Json.Decode as Decode exposing (Decoder)
import Time


{-| The active Clerk session.

`status` is passed through as ClerkJS reports it (for example `"active"`),
so a new status value never fails to decode.

-}
type alias Session =
    { id : String
    , status : String
    , lastActiveAt : Time.Posix
    , expireAt : Time.Posix
    }


{-| Decode a `Session` from the JSON the shim sends.

    { "id": "sess_1"
    , "status": "active"
    , "lastActiveAt": 1700000000000
    , "expireAt": 1700003600000
    }

Both timestamps arrive as epoch milliseconds.

-}
decoder : Decoder Session
decoder =
    Decode.map4 Session
        (Decode.field "id" Decode.string)
        (Decode.field "status" Decode.string)
        (Decode.field "lastActiveAt" Protocol.posixMillis)
        (Decode.field "expireAt" Protocol.posixMillis)

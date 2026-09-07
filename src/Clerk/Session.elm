module Clerk.Session exposing (Session, FactorVerificationAge, decoder)

{-| The Clerk session resource, with the fields listed in `coverage.json`.

The session token is deliberately absent: tokens are only available through
`Clerk.requestToken`, which round-trips to ClerkJS so the token is always
fresh. The session's `user` is not repeated here either; it is the sibling
`user` field of `Clerk.SignedIn`.

@docs Session, FactorVerificationAge, decoder

-}

import Clerk.Actor as Actor exposing (Actor)
import Clerk.Internal.Decode exposing (andMap)
import Clerk.Internal.Protocol as Protocol
import Clerk.PublicUserData as PublicUserData exposing (PublicUserData)
import Json.Decode as Decode exposing (Decoder)
import Time


{-| The active Clerk session.

`status` is passed through as ClerkJS reports it (for example `"active"`),
so a new status value never fails to decode. `tasks` holds the pending
session task keys (`"choose-organization"`, `"reset-password"`,
`"setup-mfa"`) and `currentTask` the one ClerkJS is currently asking for.
`actor` is set while an admin is impersonating the user.

-}
type alias Session =
    { id : String
    , status : String
    , expireAt : Time.Posix
    , abandonAt : Time.Posix
    , lastActiveAt : Time.Posix
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    , factorVerificationAge : Maybe FactorVerificationAge
    , lastActiveOrganizationId : Maybe String
    , actor : Maybe Actor
    , tasks : List String
    , currentTask : Maybe String
    , publicUserData : PublicUserData
    }


{-| Minutes since the first and second authentication factors were verified,
as ClerkJS reports them for step-up checks. `Nothing` on the session when
ClerkJS has no age information.
-}
type alias FactorVerificationAge =
    { firstFactorAge : Int
    , secondFactorAge : Int
    }


{-| Decode a `Session` from the JSON the shim sends.

    { "id": "sess_1"
    , "status": "active"
    , "expireAt": 1700003600000
    , "abandonAt": 1702592000000
    , "lastActiveAt": 1700000000000
    , "createdAt": 1699990000000
    , "updatedAt": 1700000000000
    , "factorVerificationAge": { "firstFactorAge": 5, "secondFactorAge": -1 }
    , "lastActiveOrganizationId": "org_1"
    , "actor": null
    , "tasks": []
    , "currentTask": null
    , "publicUserData": PublicUserData
    }

Timestamps arrive as epoch milliseconds. `factorVerificationAge`, `actor`,
`lastActiveOrganizationId` and `currentTask` accept `null`.

-}
decoder : Decoder Session
decoder =
    Decode.succeed Session
        |> andMap (Decode.field "id" Decode.string)
        |> andMap (Decode.field "status" Decode.string)
        |> andMap (Decode.field "expireAt" Protocol.posixMillis)
        |> andMap (Decode.field "abandonAt" Protocol.posixMillis)
        |> andMap (Decode.field "lastActiveAt" Protocol.posixMillis)
        |> andMap (Decode.field "createdAt" Protocol.posixMillis)
        |> andMap (Decode.field "updatedAt" Protocol.posixMillis)
        |> andMap (Decode.field "factorVerificationAge" (Decode.nullable factorVerificationAgeDecoder))
        |> andMap (Decode.field "lastActiveOrganizationId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "actor" (Decode.nullable Actor.decoder))
        |> andMap (Decode.field "tasks" (Decode.list Decode.string))
        |> andMap (Decode.field "currentTask" (Decode.nullable Decode.string))
        |> andMap (Decode.field "publicUserData" PublicUserData.decoder)


factorVerificationAgeDecoder : Decoder FactorVerificationAge
factorVerificationAgeDecoder =
    Decode.map2 FactorVerificationAge
        (Decode.field "firstFactorAge" Decode.int)
        (Decode.field "secondFactorAge" Decode.int)

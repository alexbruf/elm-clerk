module Clerk.User exposing (User, decoder)

{-| The Clerk user resource, reduced to the fields listed in `coverage.json`.

Fields that ClerkJS exposes but this package does not decode are simply
ignored, so a Clerk release that adds a field cannot break decoding.

@docs User, decoder

-}

import Clerk.Internal.Protocol as Protocol
import Json.Decode as Decode exposing (Decoder)
import Time


{-| A signed-in Clerk user.

`primaryEmailAddress` is the email address string itself
(`user.primaryEmailAddress?.emailAddress` in ClerkJS), not the resource object.

-}
type alias User =
    { id : String
    , primaryEmailAddress : Maybe String
    , firstName : Maybe String
    , lastName : Maybe String
    , imageUrl : String
    , createdAt : Maybe Time.Posix
    }


{-| Decode a `User` from the JSON the shim sends.

    { "id": "user_1"
    , "primaryEmailAddress": "ada@example.com"
    , "firstName": "Ada"
    , "lastName": "Lovelace"
    , "imageUrl": "https://img.clerk.com/ada"
    , "createdAt": 1700000000000
    }

Every nullable field accepts `null`. `createdAt` arrives as epoch
milliseconds.

-}
decoder : Decoder User
decoder =
    Decode.map6 User
        (Decode.field "id" Decode.string)
        (Decode.field "primaryEmailAddress" (Decode.nullable Decode.string))
        (Decode.field "firstName" (Decode.nullable Decode.string))
        (Decode.field "lastName" (Decode.nullable Decode.string))
        (Decode.field "imageUrl" Decode.string)
        (Decode.field "createdAt" (Decode.nullable Protocol.posixMillis))

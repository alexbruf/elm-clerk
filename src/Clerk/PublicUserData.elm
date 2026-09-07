module Clerk.PublicUserData exposing (PublicUserData, decoder)

{-| The public snapshot of a user that Clerk attaches to a session and to an
organization membership.

It is deliberately smaller than `Clerk.User`: it is the data Clerk is happy
to show to other members of an organization.

@docs PublicUserData, decoder

-}

import Clerk.Internal.Decode exposing (andMap)
import Json.Decode as Decode exposing (Decoder)


{-| The public fields of a user.

`identifier` is whatever the user signs in with (an email address, a phone
number or a username).

-}
type alias PublicUserData =
    { firstName : Maybe String
    , lastName : Maybe String
    , imageUrl : String
    , hasImage : Bool
    , identifier : String
    , userId : Maybe String
    , username : Maybe String
    , banned : Bool
    , deprovisioned : Bool
    }


{-| Decode a `PublicUserData` from the JSON the shim sends.

    { "firstName": "Ada"
    , "lastName": "Lovelace"
    , "imageUrl": "https://img.clerk.com/ada"
    , "hasImage": true
    , "identifier": "ada@example.com"
    , "userId": "user_1"
    , "username": "ada"
    , "banned": false
    , "deprovisioned": false
    }

`banned` and `deprovisioned` are optional in ClerkJS; the shim sends
`false` when they are absent.

-}
decoder : Decoder PublicUserData
decoder =
    Decode.succeed PublicUserData
        |> andMap (Decode.field "firstName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "lastName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "imageUrl" Decode.string)
        |> andMap (Decode.field "hasImage" Decode.bool)
        |> andMap (Decode.field "identifier" Decode.string)
        |> andMap (Decode.field "userId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "username" (Decode.nullable Decode.string))
        |> andMap (Decode.field "banned" Decode.bool)
        |> andMap (Decode.field "deprovisioned" Decode.bool)

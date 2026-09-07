module Clerk.Organization exposing (Organization, decoder)

{-| The Clerk organization resource, with the fields listed in
`coverage.json`.

An organization is only present when one is active; see
`Clerk.setActiveOrganization`.

@docs Organization, decoder

-}

import Clerk.Internal.Decode exposing (andMap)
import Clerk.Internal.Protocol as Protocol
import Json.Decode as Decode exposing (Decoder, Value)
import Time


{-| The active Clerk organization.

`publicMetadata` is passed through untouched as a JSON value, which is
always an object.

-}
type alias Organization =
    { id : String
    , name : String
    , slug : Maybe String
    , imageUrl : String
    , hasImage : Bool
    , membersCount : Int
    , pendingInvitationsCount : Int
    , publicMetadata : Value
    , adminDeleteEnabled : Bool
    , maxAllowedMemberships : Int
    , selfServeSSOEnabled : Bool
    , exclusiveMembership : Bool
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    }


{-| Decode an `Organization` from the JSON the shim sends.

    { "id": "org_1"
    , "name": "Acme"
    , "slug": "acme"
    , "imageUrl": "https://img.clerk.com/acme"
    , "hasImage": true
    , "membersCount": 12
    , "pendingInvitationsCount": 3
    , "publicMetadata": {}
    , "adminDeleteEnabled": true
    , "maxAllowedMemberships": 25
    , "selfServeSSOEnabled": false
    , "exclusiveMembership": false
    , "createdAt": 1700000000000
    , "updatedAt": 1700003600000
    }

`slug` accepts `null`; both timestamps arrive as epoch milliseconds.

-}
decoder : Decoder Organization
decoder =
    Decode.succeed Organization
        |> andMap (Decode.field "id" Decode.string)
        |> andMap (Decode.field "name" Decode.string)
        |> andMap (Decode.field "slug" (Decode.nullable Decode.string))
        |> andMap (Decode.field "imageUrl" Decode.string)
        |> andMap (Decode.field "hasImage" Decode.bool)
        |> andMap (Decode.field "membersCount" Decode.int)
        |> andMap (Decode.field "pendingInvitationsCount" Decode.int)
        |> andMap (Decode.field "publicMetadata" Decode.value)
        |> andMap (Decode.field "adminDeleteEnabled" Decode.bool)
        |> andMap (Decode.field "maxAllowedMemberships" Decode.int)
        |> andMap (Decode.field "selfServeSSOEnabled" Decode.bool)
        |> andMap (Decode.field "exclusiveMembership" Decode.bool)
        |> andMap (Decode.field "createdAt" Protocol.posixMillis)
        |> andMap (Decode.field "updatedAt" Protocol.posixMillis)

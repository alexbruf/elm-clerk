module Clerk.OrganizationMembership exposing (OrganizationMembership, decoder)

{-| The Clerk organization membership resource, one entry of
`Clerk.User`'s `organizationMemberships`.

@docs OrganizationMembership, decoder

-}

import Clerk.Internal.Decode exposing (andMap)
import Clerk.Internal.Protocol as Protocol
import Clerk.Organization as Organization exposing (Organization)
import Clerk.PublicUserData as PublicUserData exposing (PublicUserData)
import Json.Decode as Decode exposing (Decoder, Value)
import Time


{-| One membership tying a user to an organization.

`role` is the role key (`"org:admin"`) and `roleName` its display name.
`publicMetadata` is passed through untouched as a JSON value, which is
always an object.

-}
type alias OrganizationMembership =
    { id : String
    , organization : Organization
    , permissions : List String
    , publicMetadata : Value
    , publicUserData : Maybe PublicUserData
    , role : String
    , roleName : String
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    }


{-| Decode an `OrganizationMembership` from the JSON the shim sends.

    { "id": "orgmem_1"
    , "organization": Organization
    , "permissions": [ "org:sys_profile:manage" ]
    , "publicMetadata": {}
    , "publicUserData": PublicUserData
    , "role": "org:admin"
    , "roleName": "Admin"
    , "createdAt": 1700000000000
    , "updatedAt": 1700003600000
    }

`permissions` is `[]` when ClerkJS has none, and `publicUserData` accepts
`null`.

-}
decoder : Decoder OrganizationMembership
decoder =
    Decode.succeed OrganizationMembership
        |> andMap (Decode.field "id" Decode.string)
        |> andMap (Decode.field "organization" Organization.decoder)
        |> andMap (Decode.field "permissions" (Decode.list Decode.string))
        |> andMap (Decode.field "publicMetadata" Decode.value)
        |> andMap (Decode.field "publicUserData" (Decode.nullable PublicUserData.decoder))
        |> andMap (Decode.field "role" Decode.string)
        |> andMap (Decode.field "roleName" Decode.string)
        |> andMap (Decode.field "createdAt" Protocol.posixMillis)
        |> andMap (Decode.field "updatedAt" Protocol.posixMillis)

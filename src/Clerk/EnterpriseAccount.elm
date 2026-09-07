module Clerk.EnterpriseAccount exposing (EnterpriseAccount, decoder)

{-| The Clerk enterprise account resource, one entry of `Clerk.User`'s
`enterpriseAccounts`: an account the user holds through enterprise SSO.

@docs EnterpriseAccount, decoder

-}

import Clerk.EnterpriseConnection as EnterpriseConnection exposing (EnterpriseConnection)
import Clerk.Internal.Decode exposing (andMap)
import Clerk.Internal.Protocol as Protocol
import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder, Value)
import Time


{-| One enterprise SSO account.

`publicMetadata` is passed through untouched as a JSON value, which is
always an object.

-}
type alias EnterpriseAccount =
    { id : Maybe String
    , active : Bool
    , emailAddress : String
    , enterpriseConnectionId : Maybe String
    , enterpriseConnection : Maybe EnterpriseConnection
    , firstName : Maybe String
    , lastName : Maybe String
    , protocol : String
    , provider : String
    , providerUserId : Maybe String
    , publicMetadata : Value
    , verification : Maybe Verification
    , lastAuthenticatedAt : Maybe Time.Posix
    }


{-| Decode an `EnterpriseAccount` from the JSON the shim sends.

    { "id": "eac_2"
    , "active": true
    , "emailAddress": "ada@acme.test"
    , "enterpriseConnectionId": "conn_1"
    , "enterpriseConnection": EnterpriseConnection
    , "firstName": "Ada"
    , "lastName": "Lovelace"
    , "protocol": "saml"
    , "provider": "saml_okta"
    , "providerUserId": "okta_1"
    , "publicMetadata": {}
    , "verification": Verification
    , "lastAuthenticatedAt": 1700000000000
    }

`lastAuthenticatedAt` arrives as epoch milliseconds and accepts `null`.

-}
decoder : Decoder EnterpriseAccount
decoder =
    Decode.succeed EnterpriseAccount
        |> andMap (Decode.field "id" (Decode.nullable Decode.string))
        |> andMap (Decode.field "active" Decode.bool)
        |> andMap (Decode.field "emailAddress" Decode.string)
        |> andMap (Decode.field "enterpriseConnectionId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "enterpriseConnection" (Decode.nullable EnterpriseConnection.decoder))
        |> andMap (Decode.field "firstName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "lastName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "protocol" Decode.string)
        |> andMap (Decode.field "provider" Decode.string)
        |> andMap (Decode.field "providerUserId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "publicMetadata" Decode.value)
        |> andMap (Decode.field "verification" (Decode.nullable Verification.decoder))
        |> andMap (Decode.field "lastAuthenticatedAt" (Decode.nullable Protocol.posixMillis))

module Clerk.User exposing (User, decoder)

{-| The Clerk user resource, with the fields listed in `coverage.json`.

Fields that ClerkJS exposes but this package does not decode are simply
ignored, so a Clerk release that adds a field cannot break decoding.

@docs User, decoder

-}

import Clerk.EmailAddress as EmailAddress exposing (EmailAddress)
import Clerk.EnterpriseAccount as EnterpriseAccount exposing (EnterpriseAccount)
import Clerk.ExternalAccount as ExternalAccount exposing (ExternalAccount)
import Clerk.Internal.Decode exposing (andMap)
import Clerk.Internal.Protocol as Protocol
import Clerk.OrganizationMembership as OrganizationMembership exposing (OrganizationMembership)
import Clerk.Passkey as Passkey exposing (Passkey)
import Clerk.PhoneNumber as PhoneNumber exposing (PhoneNumber)
import Clerk.Web3Wallet as Web3Wallet exposing (Web3Wallet)
import Json.Decode as Decode exposing (Decoder, Value)
import Time


{-| A signed-in Clerk user.

`primaryEmailAddress`, `primaryPhoneNumber` and `primaryWeb3Wallet` are the
identifier strings themselves (`user.primaryEmailAddress?.emailAddress` in
ClerkJS), not resource objects; the full resources are in the matching
lists, keyed by the `primary...Id` fields. `publicMetadata` and
`unsafeMetadata` are passed through untouched as JSON values, always
objects.

-}
type alias User =
    { id : String
    , externalId : Maybe String
    , username : Maybe String
    , fullName : Maybe String
    , firstName : Maybe String
    , lastName : Maybe String
    , imageUrl : String
    , hasImage : Bool
    , primaryEmailAddressId : Maybe String
    , primaryEmailAddress : Maybe String
    , primaryPhoneNumberId : Maybe String
    , primaryPhoneNumber : Maybe String
    , primaryWeb3WalletId : Maybe String
    , primaryWeb3Wallet : Maybe String
    , emailAddresses : List EmailAddress
    , phoneNumbers : List PhoneNumber
    , web3Wallets : List Web3Wallet
    , externalAccounts : List ExternalAccount
    , enterpriseAccounts : List EnterpriseAccount
    , passkeys : List Passkey
    , organizationMemberships : List OrganizationMembership
    , passwordEnabled : Bool
    , totpEnabled : Bool
    , backupCodeEnabled : Bool
    , twoFactorEnabled : Bool
    , publicMetadata : Value
    , unsafeMetadata : Value
    , lastSignInAt : Maybe Time.Posix
    , legalAcceptedAt : Maybe Time.Posix
    , createdAt : Maybe Time.Posix
    , updatedAt : Maybe Time.Posix
    }


{-| Decode a `User` from the JSON the shim sends.

    { "id": "user_1"
    , "externalId": null
    , "username": "ada"
    , "fullName": "Ada Lovelace"
    , "firstName": "Ada"
    , "lastName": "Lovelace"
    , "imageUrl": "https://img.clerk.com/ada"
    , "hasImage": true
    , "primaryEmailAddressId": "idn_1"
    , "primaryEmailAddress": "ada@example.com"
    , "primaryPhoneNumberId": null
    , "primaryPhoneNumber": null
    , "primaryWeb3WalletId": null
    , "primaryWeb3Wallet": null
    , "emailAddresses": [ EmailAddress ]
    , "phoneNumbers": []
    , "web3Wallets": []
    , "externalAccounts": []
    , "enterpriseAccounts": []
    , "passkeys": []
    , "organizationMemberships": []
    , "passwordEnabled": true
    , "totpEnabled": false
    , "backupCodeEnabled": false
    , "twoFactorEnabled": false
    , "publicMetadata": {}
    , "unsafeMetadata": {}
    , "lastSignInAt": 1700000000000
    , "legalAcceptedAt": null
    , "createdAt": 1699990000000
    , "updatedAt": 1700000000000
    }

Every nullable field accepts `null`; lists may be empty. Timestamps arrive
as epoch milliseconds.

-}
decoder : Decoder User
decoder =
    Decode.succeed User
        |> andMap (Decode.field "id" Decode.string)
        |> andMap (Decode.field "externalId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "username" (Decode.nullable Decode.string))
        |> andMap (Decode.field "fullName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "firstName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "lastName" (Decode.nullable Decode.string))
        |> andMap (Decode.field "imageUrl" Decode.string)
        |> andMap (Decode.field "hasImage" Decode.bool)
        |> andMap (Decode.field "primaryEmailAddressId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "primaryEmailAddress" (Decode.nullable Decode.string))
        |> andMap (Decode.field "primaryPhoneNumberId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "primaryPhoneNumber" (Decode.nullable Decode.string))
        |> andMap (Decode.field "primaryWeb3WalletId" (Decode.nullable Decode.string))
        |> andMap (Decode.field "primaryWeb3Wallet" (Decode.nullable Decode.string))
        |> andMap (Decode.field "emailAddresses" (Decode.list EmailAddress.decoder))
        |> andMap (Decode.field "phoneNumbers" (Decode.list PhoneNumber.decoder))
        |> andMap (Decode.field "web3Wallets" (Decode.list Web3Wallet.decoder))
        |> andMap (Decode.field "externalAccounts" (Decode.list ExternalAccount.decoder))
        |> andMap (Decode.field "enterpriseAccounts" (Decode.list EnterpriseAccount.decoder))
        |> andMap (Decode.field "passkeys" (Decode.list Passkey.decoder))
        |> andMap (Decode.field "organizationMemberships" (Decode.list OrganizationMembership.decoder))
        |> andMap (Decode.field "passwordEnabled" Decode.bool)
        |> andMap (Decode.field "totpEnabled" Decode.bool)
        |> andMap (Decode.field "backupCodeEnabled" Decode.bool)
        |> andMap (Decode.field "twoFactorEnabled" Decode.bool)
        |> andMap (Decode.field "publicMetadata" Decode.value)
        |> andMap (Decode.field "unsafeMetadata" Decode.value)
        |> andMap (Decode.field "lastSignInAt" (Decode.nullable Protocol.posixMillis))
        |> andMap (Decode.field "legalAcceptedAt" (Decode.nullable Protocol.posixMillis))
        |> andMap (Decode.field "createdAt" (Decode.nullable Protocol.posixMillis))
        |> andMap (Decode.field "updatedAt" (Decode.nullable Protocol.posixMillis))

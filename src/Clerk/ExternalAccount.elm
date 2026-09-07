module Clerk.ExternalAccount exposing (ExternalAccount, decoder)

{-| The Clerk external account resource, one entry of `Clerk.User`'s
`externalAccounts`: an OAuth account the user has connected.

@docs ExternalAccount, decoder

-}

import Clerk.Internal.Decode exposing (andMap)
import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder, Value)


{-| One connected OAuth account.

`approvedScopes` is the space separated scope string exactly as the
provider returned it. `publicMetadata` is passed through untouched as a
JSON value, which is always an object.

-}
type alias ExternalAccount =
    { id : String
    , identificationId : String
    , provider : String
    , providerUserId : String
    , emailAddress : String
    , approvedScopes : String
    , firstName : String
    , lastName : String
    , imageUrl : String
    , username : Maybe String
    , phoneNumber : Maybe String
    , label : Maybe String
    , publicMetadata : Value
    , verification : Maybe Verification
    }


{-| Decode an `ExternalAccount` from the JSON the shim sends.

    { "id": "eac_1"
    , "identificationId": "idn_4"
    , "provider": "google"
    , "providerUserId": "1234567890"
    , "emailAddress": "ada@example.com"
    , "approvedScopes": "email profile"
    , "firstName": "Ada"
    , "lastName": "Lovelace"
    , "imageUrl": "https://img.clerk.com/ada"
    , "username": null
    , "phoneNumber": null
    , "label": null
    , "publicMetadata": {}
    , "verification": Verification
    }

-}
decoder : Decoder ExternalAccount
decoder =
    Decode.succeed ExternalAccount
        |> andMap (Decode.field "id" Decode.string)
        |> andMap (Decode.field "identificationId" Decode.string)
        |> andMap (Decode.field "provider" Decode.string)
        |> andMap (Decode.field "providerUserId" Decode.string)
        |> andMap (Decode.field "emailAddress" Decode.string)
        |> andMap (Decode.field "approvedScopes" Decode.string)
        |> andMap (Decode.field "firstName" Decode.string)
        |> andMap (Decode.field "lastName" Decode.string)
        |> andMap (Decode.field "imageUrl" Decode.string)
        |> andMap (Decode.field "username" (Decode.nullable Decode.string))
        |> andMap (Decode.field "phoneNumber" (Decode.nullable Decode.string))
        |> andMap (Decode.field "label" (Decode.nullable Decode.string))
        |> andMap (Decode.field "publicMetadata" Decode.value)
        |> andMap (Decode.field "verification" (Decode.nullable Verification.decoder))

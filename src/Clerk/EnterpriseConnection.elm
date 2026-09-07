module Clerk.EnterpriseConnection exposing (EnterpriseConnection, decoder)

{-| The Clerk enterprise connection resource, the SSO connection behind an
enterprise account.

@docs EnterpriseConnection, decoder

-}

import Clerk.Internal.Decode exposing (andMap)
import Json.Decode as Decode exposing (Decoder)


{-| One enterprise SSO connection.

`protocol` is for example `"saml"`, and `provider` names the identity
provider.

-}
type alias EnterpriseConnection =
    { id : Maybe String
    , active : Bool
    , allowIdpInitiated : Bool
    , allowSubdomains : Bool
    , disableAdditionalIdentifications : Bool
    , domain : String
    , logoPublicUrl : Maybe String
    , name : String
    , protocol : String
    , provider : String
    , syncUserAttributes : Bool
    , allowOrganizationAccountLinking : Bool
    , enterpriseConnectionId : Maybe String
    }


{-| Decode an `EnterpriseConnection` from the JSON the shim sends.

    { "id": "conn_1"
    , "active": true
    , "allowIdpInitiated": false
    , "allowSubdomains": true
    , "disableAdditionalIdentifications": false
    , "domain": "acme.test"
    , "logoPublicUrl": "https://img.clerk.com/acme"
    , "name": "Acme SAML"
    , "protocol": "saml"
    , "provider": "saml_okta"
    , "syncUserAttributes": true
    , "allowOrganizationAccountLinking": true
    , "enterpriseConnectionId": "conn_1"
    }

-}
decoder : Decoder EnterpriseConnection
decoder =
    Decode.succeed EnterpriseConnection
        |> andMap (Decode.field "id" (Decode.nullable Decode.string))
        |> andMap (Decode.field "active" Decode.bool)
        |> andMap (Decode.field "allowIdpInitiated" Decode.bool)
        |> andMap (Decode.field "allowSubdomains" Decode.bool)
        |> andMap (Decode.field "disableAdditionalIdentifications" Decode.bool)
        |> andMap (Decode.field "domain" Decode.string)
        |> andMap (Decode.field "logoPublicUrl" (Decode.nullable Decode.string))
        |> andMap (Decode.field "name" Decode.string)
        |> andMap (Decode.field "protocol" Decode.string)
        |> andMap (Decode.field "provider" Decode.string)
        |> andMap (Decode.field "syncUserAttributes" Decode.bool)
        |> andMap (Decode.field "allowOrganizationAccountLinking" Decode.bool)
        |> andMap (Decode.field "enterpriseConnectionId" (Decode.nullable Decode.string))

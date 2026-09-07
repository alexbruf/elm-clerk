module Clerk.Verification exposing (Verification, decoder)

{-| The Clerk verification resource, the state of one attempt to verify an
email address, phone number, wallet or external account.

Every field is nullable because ClerkJS leaves them unset until the
matching step of the flow has run.

@docs Verification, decoder

-}

import Clerk.Internal.Protocol as Protocol
import Json.Decode as Decode exposing (Decoder)
import Time


{-| The verification attached to another resource.

`error` is the `message` of the underlying `ClerkAPIError`, not the whole
error object. `externalVerificationRedirectURL` is the URL as a string.
Passkey `publicKey` is browser-only and is deliberately not serialized.

-}
type alias Verification =
    { status : Maybe String
    , strategy : Maybe String
    , expireAt : Maybe Time.Posix
    , error : Maybe String
    , message : Maybe String
    , nonce : Maybe String
    , externalVerificationRedirectURL : Maybe String
    , verifiedAtClient : Maybe String
    }


{-| Decode a `Verification` from the JSON the shim sends.

    { "status": "verified"
    , "strategy": "email_code"
    , "expireAt": 1700003600000
    , "error": null
    , "message": null
    , "nonce": null
    , "externalVerificationRedirectURL": null
    , "verifiedAtClient": null
    }

-}
decoder : Decoder Verification
decoder =
    Decode.map8 Verification
        (Decode.field "status" (Decode.nullable Decode.string))
        (Decode.field "strategy" (Decode.nullable Decode.string))
        (Decode.field "expireAt" (Decode.nullable Protocol.posixMillis))
        (Decode.field "error" (Decode.nullable Decode.string))
        (Decode.field "message" (Decode.nullable Decode.string))
        (Decode.field "nonce" (Decode.nullable Decode.string))
        (Decode.field "externalVerificationRedirectURL" (Decode.nullable Decode.string))
        (Decode.field "verifiedAtClient" (Decode.nullable Decode.string))

module Clerk.IdentificationLink exposing (IdentificationLink, decoder)

{-| The Clerk identification link resource, which ties an email address or
phone number back to the identification it came from.

@docs IdentificationLink, decoder

-}

import Json.Decode as Decode exposing (Decoder)


{-| One entry of an email address's or phone number's `linkedTo` list.

The JSON key `type` becomes the Elm field `type_`, because `type` is a
reserved word.

-}
type alias IdentificationLink =
    { id : String
    , type_ : String
    }


{-| Decode an `IdentificationLink` from the JSON the shim sends.

    { "id": "idn_1", "type": "oauth_google" }

-}
decoder : Decoder IdentificationLink
decoder =
    Decode.map2 IdentificationLink
        (Decode.field "id" Decode.string)
        (Decode.field "type" Decode.string)

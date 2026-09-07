module Clerk.Organization exposing (Organization, decoder)

{-| The Clerk organization resource, reduced to the fields listed in
`coverage.json`.

An organization is only present when one is active; see
`Clerk.setActiveOrganization`.

@docs Organization, decoder

-}

import Json.Decode as Decode exposing (Decoder)


{-| The active Clerk organization.
-}
type alias Organization =
    { id : String
    , name : String
    , slug : Maybe String
    , imageUrl : String
    }


{-| Decode an `Organization` from the JSON the shim sends.

    { "id": "org_1"
    , "name": "Acme"
    , "slug": "acme"
    , "imageUrl": "https://img.clerk.com/acme"
    }

`slug` accepts `null`.

-}
decoder : Decoder Organization
decoder =
    Decode.map4 Organization
        (Decode.field "id" Decode.string)
        (Decode.field "name" Decode.string)
        (Decode.field "slug" (Decode.nullable Decode.string))
        (Decode.field "imageUrl" Decode.string)

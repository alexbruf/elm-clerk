module Clerk.EmailAddress exposing (EmailAddress, decoder)

{-| The Clerk email address resource, one entry of `Clerk.User`'s
`emailAddresses`.

@docs EmailAddress, decoder

-}

import Clerk.IdentificationLink as IdentificationLink exposing (IdentificationLink)
import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder)


{-| One of a user's email addresses.

`linkedTo` is empty unless the address arrived through another
identification, such as an OAuth account.

-}
type alias EmailAddress =
    { id : String
    , emailAddress : String
    , verification : Verification
    , matchesSsoConnection : Bool
    , linkedTo : List IdentificationLink
    }


{-| Decode an `EmailAddress` from the JSON the shim sends.

    { "id": "idn_1"
    , "emailAddress": "ada@example.com"
    , "verification": Verification
    , "matchesSsoConnection": false
    , "linkedTo": [ IdentificationLink ]
    }

`linkedTo` is `[]` when ClerkJS has no links.

-}
decoder : Decoder EmailAddress
decoder =
    Decode.map5 EmailAddress
        (Decode.field "id" Decode.string)
        (Decode.field "emailAddress" Decode.string)
        (Decode.field "verification" Verification.decoder)
        (Decode.field "matchesSsoConnection" Decode.bool)
        (Decode.field "linkedTo" (Decode.list IdentificationLink.decoder))

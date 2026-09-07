module Clerk.PhoneNumber exposing (PhoneNumber, decoder)

{-| The Clerk phone number resource, one entry of `Clerk.User`'s
`phoneNumbers`.

@docs PhoneNumber, decoder

-}

import Clerk.IdentificationLink as IdentificationLink exposing (IdentificationLink)
import Clerk.Verification as Verification exposing (Verification)
import Json.Decode as Decode exposing (Decoder)


{-| One of a user's phone numbers.

`backupCodes` is empty unless ClerkJS has issued backup codes for this
number as a second factor.

-}
type alias PhoneNumber =
    { id : String
    , phoneNumber : String
    , verification : Verification
    , reservedForSecondFactor : Bool
    , defaultSecondFactor : Bool
    , linkedTo : List IdentificationLink
    , backupCodes : List String
    }


{-| Decode a `PhoneNumber` from the JSON the shim sends.

    { "id": "idn_2"
    , "phoneNumber": "+15555550100"
    , "verification": Verification
    , "reservedForSecondFactor": true
    , "defaultSecondFactor": false
    , "linkedTo": [ IdentificationLink ]
    , "backupCodes": [ "abcd-1234" ]
    }

Both lists are `[]` when ClerkJS has nothing to send.

-}
decoder : Decoder PhoneNumber
decoder =
    Decode.map7 PhoneNumber
        (Decode.field "id" Decode.string)
        (Decode.field "phoneNumber" Decode.string)
        (Decode.field "verification" Verification.decoder)
        (Decode.field "reservedForSecondFactor" Decode.bool)
        (Decode.field "defaultSecondFactor" Decode.bool)
        (Decode.field "linkedTo" (Decode.list IdentificationLink.decoder))
        (Decode.field "backupCodes" (Decode.list Decode.string))

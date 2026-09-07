module Clerk.Actor exposing (Actor, decoder)

{-| The Clerk actor claim, present on a session that is being impersonated.

@docs Actor, decoder

-}

import Json.Decode as Decode exposing (Decoder)


{-| Who is acting on behalf of the session's user.

`sub` is the impersonator's user id. The JSON key `type` becomes the Elm
field `type_`, because `type` is a reserved word.

-}
type alias Actor =
    { sub : String
    , type_ : Maybe String
    }


{-| Decode an `Actor` from the JSON the shim sends.

    { "sub": "user_admin", "type": "impersonation" }

-}
decoder : Decoder Actor
decoder =
    Decode.map2 Actor
        (Decode.field "sub" Decode.string)
        (Decode.field "type" (Decode.nullable Decode.string))

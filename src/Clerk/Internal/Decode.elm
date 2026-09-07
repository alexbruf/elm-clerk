module Clerk.Internal.Decode exposing (andMap)

{-| The one decoder combinator the resource modules share.

This module is internal: it is not exposed by the package and its API may
change in any release.

@docs andMap

-}

import Json.Decode as Decode exposing (Decoder)


{-| Apply one more field to a record constructor that is already inside a
decoder, so records with more than eight fields can be built as a pipeline:

    Decode.succeed Record
        |> andMap (Decode.field "a" Decode.string)
        |> andMap (Decode.field "b" Decode.bool)

`Json.Decode.mapN` stops at `map8`, which is why this exists.

-}
andMap : Decoder a -> Decoder (a -> b) -> Decoder b
andMap valueDecoder functionDecoder =
    functionDecoder
        |> Decode.andThen (\build -> Decode.map build valueDecoder)

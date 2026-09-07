module Clerk.Internal.Protocol exposing
    ( protocolVersion
    , Msg(..)
    , signOut, openSignIn, openSignUp, openUserProfile
    , mountSignIn, mountUserButton, unmount
    , requestToken, setActiveOrganization
    , Incoming(..), decoder
    , posixMillis
    )

{-| The wire protocol shared with the `@viewengine/elm-clerk` shim.

Every message in both directions is one JSON object of the shape

    { "v": 1, "tag": "<tag>", ...payload }

This module is internal: it is not exposed by the package and its API may
change in any release.

@docs protocolVersion
@docs Msg
@docs signOut, openSignIn, openSignUp, openUserProfile
@docs mountSignIn, mountUserButton, unmount
@docs requestToken, setActiveOrganization
@docs Incoming, decoder
@docs posixMillis

-}

import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode exposing (Value)
import Time


{-| The version carried in the `v` field of every message.
-}
protocolVersion : Int
protocolVersion =
    1



-- MESSAGES


{-| The opaque message `Clerk` hands back to `Clerk.update`. It carries the
raw JSON value the shim sent.
-}
type Msg
    = Incoming Value



-- OUTGOING


envelope : String -> List ( String, Value ) -> Value
envelope tag payload =
    Encode.object
        (( "v", Encode.int protocolVersion )
            :: ( "tag", Encode.string tag )
            :: payload
        )


{-| `{ "v": 1, "tag": "signOut" }`
-}
signOut : Value
signOut =
    envelope "signOut" []


{-| `{ "v": 1, "tag": "openSignIn" }`
-}
openSignIn : Value
openSignIn =
    envelope "openSignIn" []


{-| `{ "v": 1, "tag": "openSignUp" }`
-}
openSignUp : Value
openSignUp =
    envelope "openSignUp" []


{-| `{ "v": 1, "tag": "openUserProfile" }`
-}
openUserProfile : Value
openUserProfile =
    envelope "openUserProfile" []


{-| `{ "v": 1, "tag": "mountSignIn", "elementId": "..." }`
-}
mountSignIn : String -> Value
mountSignIn elementId =
    envelope "mountSignIn" [ ( "elementId", Encode.string elementId ) ]


{-| `{ "v": 1, "tag": "mountUserButton", "elementId": "..." }`
-}
mountUserButton : String -> Value
mountUserButton elementId =
    envelope "mountUserButton" [ ( "elementId", Encode.string elementId ) ]


{-| `{ "v": 1, "tag": "unmount", "elementId": "..." }`
-}
unmount : String -> Value
unmount elementId =
    envelope "unmount" [ ( "elementId", Encode.string elementId ) ]


{-| `{ "v": 1, "tag": "requestToken", "requestId": "...", "template": "..." | null }`
-}
requestToken : { requestId : String, template : Maybe String } -> Value
requestToken options =
    envelope "requestToken"
        [ ( "requestId", Encode.string options.requestId )
        , ( "template"
          , case options.template of
                Just template ->
                    Encode.string template

                Nothing ->
                    Encode.null
          )
        ]


{-| `{ "v": 1, "tag": "setActiveOrganization", "organizationId": "..." }`
-}
setActiveOrganization : String -> Value
setActiveOrganization organizationId =
    envelope "setActiveOrganization"
        [ ( "organizationId", Encode.string organizationId ) ]



-- INCOMING


{-| A decoded message from the shim, parameterised over the state
representation so this module does not depend on `Clerk`.

`ProtocolError` covers both an explicit `error` message from the shim and
anything this package cannot make sense of, such as an unknown tag or an
unsupported protocol version.

-}
type Incoming state
    = StateChanged state
    | TokenReceived { requestId : String, token : String }
    | TokenFailed { requestId : String, reason : String }
    | ProtocolError String


{-| Decode an incoming message, given a decoder for the state payload.

An unknown tag or an unexpected `v` decodes to `ProtocolError` rather than
failing, so the consumer always gets an event describing the problem.

-}
decoder : Decoder state -> Decoder (Incoming state)
decoder stateDecoder =
    Decode.field "v" Decode.int
        |> Decode.andThen
            (\version ->
                if version == protocolVersion then
                    Decode.field "tag" Decode.string
                        |> Decode.andThen (payloadDecoder stateDecoder)

                else
                    Decode.succeed
                        (ProtocolError
                            ("unsupported protocol version: "
                                ++ String.fromInt version
                                ++ " (expected "
                                ++ String.fromInt protocolVersion
                                ++ ")"
                            )
                        )
            )


payloadDecoder : Decoder state -> String -> Decoder (Incoming state)
payloadDecoder stateDecoder tag =
    case tag of
        "stateChanged" ->
            Decode.map StateChanged (Decode.field "state" stateDecoder)

        "tokenReceived" ->
            Decode.map2 (\requestId token -> TokenReceived { requestId = requestId, token = token })
                (Decode.field "requestId" Decode.string)
                (Decode.field "token" Decode.string)

        "tokenFailed" ->
            Decode.map2 (\requestId reason -> TokenFailed { requestId = requestId, reason = reason })
                (Decode.field "requestId" Decode.string)
                (Decode.field "reason" Decode.string)

        "error" ->
            Decode.map ProtocolError (Decode.field "message" Decode.string)

        _ ->
            Decode.succeed (ProtocolError ("unknown tag: " ++ tag))



-- SHARED DECODERS


{-| Decode epoch milliseconds, which JSON may carry as a float, into a
`Time.Posix`.
-}
posixMillis : Decoder Time.Posix
posixMillis =
    Decode.map (round >> Time.millisToPosix) Decode.float

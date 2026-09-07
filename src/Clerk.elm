module Clerk exposing
    ( State(..), Msg, Ports, Event(..)
    , init, update, subscriptions
    , signOut, openSignIn, openSignUp, openUserProfile
    , mountSignIn, mountUserButton, unmount
    , requestToken, setActiveOrganization
    , stateDecoder
    )

{-| Clerk authentication for Elm, bridged through ClerkJS by the companion
npm package `@viewengine/elm-clerk`.

This package holds the typed state, the decoders and the command API. The
two ports live in your own application, because the Elm package registry
does not allow a package to declare them. Copy `Ports.elm` from the
elm-clerk repository into your app: it declares `clerkOut : Value -> Cmd
msg` and `clerkIn : (Value -> msg) -> Sub msg`, and it never changes.

Then hand both of them to this package as a `Ports` record:

    clerkPorts : Clerk.Ports Msg
    clerkPorts =
        { toJs = Ports.clerkOut, fromJs = Ports.clerkIn }


# State

@docs State, Msg, Ports, Event


# Wiring

@docs init, update, subscriptions


# Commands

@docs signOut, openSignIn, openSignUp, openUserProfile
@docs mountSignIn, mountUserButton, unmount
@docs requestToken, setActiveOrganization


# Flags

@docs stateDecoder

-}

import Clerk.Internal.Protocol as Protocol
import Clerk.Organization exposing (Organization)
import Clerk.Session exposing (Session)
import Clerk.User exposing (User)
import Json.Decode as Decode exposing (Decoder, Value)


{-| Everything the app knows about the current visitor.

`Loading` is the only state before the shim reports the first
`stateChanged`, so every app must render something for it.

-}
type State
    = Loading
    | SignedOut
    | SignedIn { session : Session, user : User, organization : Maybe Organization }


{-| An opaque message produced by [`subscriptions`](#subscriptions). Wrap it
in one of your own constructors and hand it back to [`update`](#update).
-}
type alias Msg =
    Protocol.Msg


{-| The two ports the shim talks over. They are passed to every function in
this module, so this package declares none of its own.
-}
type alias Ports msg =
    { toJs : Value -> Cmd msg
    , fromJs : (Value -> msg) -> Sub msg
    }


{-| What just happened, returned by [`update`](#update) so the app can react
to it. Ignore the events you do not care about.

`Error` carries a human readable description of anything that went wrong,
including an unknown message tag and a message this package could not
decode. It never crashes the app.

-}
type Event
    = StateChanged State
    | TokenReceived { requestId : String, token : String }
    | TokenFailed { requestId : String, reason : String }
    | Error String


{-| The state before the shim has said anything, which is `Loading`.

If the shim hands you the current state as a flag, decode that with
[`stateDecoder`](#stateDecoder) instead so the first render is correct.

-}
init : State
init =
    Loading


{-| Fold an incoming message into the state.

A `stateChanged` message replaces the state and reports
`Just (StateChanged newState)`; every other message leaves the state alone
and only reports an event.

    update : Msg -> Model -> ( Model, Cmd Msg )
    update msg model =
        case msg of
            ClerkMsg clerkMsg ->
                let
                    ( clerk, cmd, event ) =
                        Clerk.update clerkPorts clerkMsg model.clerk
                in
                ( { model | clerk = clerk }, cmd )

-}
update : Ports msg -> Msg -> State -> ( State, Cmd msg, Maybe Event )
update _ (Protocol.Incoming value) state =
    case Decode.decodeValue (Protocol.decoder stateDecoder) value of
        Ok (Protocol.StateChanged newState) ->
            ( newState, Cmd.none, Just (StateChanged newState) )

        Ok (Protocol.TokenReceived payload) ->
            ( state, Cmd.none, Just (TokenReceived payload) )

        Ok (Protocol.TokenFailed payload) ->
            ( state, Cmd.none, Just (TokenFailed payload) )

        Ok (Protocol.ProtocolError message) ->
            ( state, Cmd.none, Just (Error message) )

        Err error ->
            ( state, Cmd.none, Just (Error (Decode.errorToString error)) )


{-| Listen for messages from the shim.

    subscriptions : Model -> Sub Msg
    subscriptions _ =
        Clerk.subscriptions clerkPorts ClerkMsg

-}
subscriptions : Ports msg -> (Msg -> msg) -> Sub msg
subscriptions ports toMsg =
    ports.fromJs (\value -> toMsg (Protocol.Incoming value))


{-| Sign the current user out, ending the session in every tab.
-}
signOut : Ports msg -> Cmd msg
signOut ports =
    ports.toJs Protocol.signOut


{-| Open Clerk's hosted sign-in modal.
-}
openSignIn : Ports msg -> Cmd msg
openSignIn ports =
    ports.toJs Protocol.openSignIn


{-| Open Clerk's hosted sign-up modal.
-}
openSignUp : Ports msg -> Cmd msg
openSignUp ports =
    ports.toJs Protocol.openSignUp


{-| Open Clerk's hosted user profile modal.
-}
openUserProfile : Ports msg -> Cmd msg
openUserProfile ports =
    ports.toJs Protocol.openUserProfile


{-| Mount Clerk's sign-in component into the element with the given id.

The element must already be in the document, so send this from a command
after the view that contains it has rendered.

-}
mountSignIn : Ports msg -> String -> Cmd msg
mountSignIn ports elementId =
    ports.toJs (Protocol.mountSignIn elementId)


{-| Mount Clerk's user button into the element with the given id.
-}
mountUserButton : Ports msg -> String -> Cmd msg
mountUserButton ports elementId =
    ports.toJs (Protocol.mountUserButton elementId)


{-| Unmount whatever Clerk component was mounted on the element with the
given id.
-}
unmount : Ports msg -> String -> Cmd msg
unmount ports elementId =
    ports.toJs (Protocol.unmount elementId)


{-| Ask for a session token, optionally minted from a JWT template.

You choose the `requestId` and get it back on the matching
`TokenReceived` or `TokenFailed` event, so several requests can be in
flight at once.

    Clerk.requestToken clerkPorts
        { requestId = "backend-call-1", template = Just "backend" }

-}
requestToken : Ports msg -> { requestId : String, template : Maybe String } -> Cmd msg
requestToken ports options =
    ports.toJs (Protocol.requestToken options)


{-| Make the organization with the given id the active one. The shim
reports the result as a `stateChanged` event.
-}
setActiveOrganization : Ports msg -> String -> Cmd msg
setActiveOrganization ports organizationId =
    ports.toJs (Protocol.setActiveOrganization organizationId)


{-| Decode the state JSON the shim sends, which is also what it passes as
the initial flag:

    { "status": "loading" }

    { "status": "signedOut" }

    { "status": "signedIn"
    , "session": Session
    , "user": User
    , "organization": Organization | null
    }

Use it on your flags so the very first render already knows who is signed
in:

    Decode.decodeValue Clerk.stateDecoder flags
        |> Result.withDefault Clerk.init

-}
stateDecoder : Decoder State
stateDecoder =
    Decode.field "status" Decode.string
        |> Decode.andThen
            (\status ->
                case status of
                    "loading" ->
                        Decode.succeed Loading

                    "signedOut" ->
                        Decode.succeed SignedOut

                    "signedIn" ->
                        Decode.map3
                            (\session user organization ->
                                SignedIn
                                    { session = session
                                    , user = user
                                    , organization = organization
                                    }
                            )
                            (Decode.field "session" Clerk.Session.decoder)
                            (Decode.field "user" Clerk.User.decoder)
                            (Decode.field "organization" (Decode.nullable Clerk.Organization.decoder))

                    _ ->
                        Decode.fail ("unknown status: " ++ status)
            )

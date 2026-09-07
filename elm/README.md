# elm-clerk

Clerk authentication for Elm apps. This package gives you typed `State`,
`Event`, decoders, and a small command API. The browser side is handled by
the companion npm package `@viewengine/elm-clerk`, which loads ClerkJS and
bridges two ports.

## Install

```sh
elm install alexbruf/elm-clerk
bun add @viewengine/elm-clerk
```

## Wiring

Copy this file into your project verbatim as `src/Ports.elm`:

```elm
port module Ports exposing (clerkIn, clerkOut)

import Json.Encode exposing (Value)

port clerkOut : Value -> Cmd msg
port clerkIn : (Value -> msg) -> Sub msg
```

Then build the record the package needs and wire it into your app:

```elm
import Clerk
import Ports

clerkPorts : Clerk.Ports msg
clerkPorts =
    { toJs = Ports.clerkOut, fromJs = Ports.clerkIn }

type Msg
    = ClerkMsg Clerk.Msg
    | ClickedSignOut

update msg model =
    case msg of
        ClerkMsg clerkMsg ->
            let
                ( clerkState, cmd, maybeEvent ) =
                    Clerk.update clerkPorts clerkMsg model.clerk
            in
            ( { model | clerk = clerkState }, cmd )

        ClickedSignOut ->
            ( model, Clerk.signOut clerkPorts )

subscriptions model =
    Clerk.subscriptions clerkPorts ClerkMsg
```

On the JavaScript side, call `attachClerk(app, { publishableKey })` once after
`Elm.Main.init`. See the repository README for the full walkthrough, the
wire protocol, and an Elm Land style `Effect.elm` adapter:
https://github.com/alexbruf/elm-clerk

## States and events

`Clerk.State` is `Loading`, `SignedOut`, or `SignedIn { session, user, organization }`.
`Loading` is the only state before the first message from ClerkJS, so render
something for it.

`Clerk.update` returns a `Maybe Clerk.Event`: `StateChanged`, `TokenReceived`,
`TokenFailed`, or `Error`. Token requests carry a consumer supplied `requestId`
so concurrent requests never collide.

module Effect exposing
    ( Effect
    , none, batch, sendCmd
    , signOut, openSignIn, openSignUp, openUserProfile
    , mountSignIn, mountUserButton, unmount
    , requestToken, setActiveOrganization
    , map
    , toCmd
    )

{-| An Elm Land style effect type.

Elm Land apps never return `Cmd Msg` directly from `init`/`update`; they
return an `Effect Msg`, and the framework's runtime turns that into a real
`Cmd Msg` in exactly one place (`Main.elm`, here; a generated Elm Land
project does the same thing in its own runtime module). Pages and other
modules describe *what* should happen without needing to know *how* to talk
to the outside world, which keeps `Ports msg` (and therefore `elm-clerk`
itself) out of every function signature except the one boundary that needs
it.

A consumer wiring `elm-clerk` into a real Elm Land app adds one constructor
per `elm-clerk` command to their existing `Effect` type, following the
`SendToLocalStorage`-style pattern Elm Land already uses for its own
port effects: store the *data* needed to perform the effect, not a function
closed over `Ports msg`. That is what `ClerkAction` below is. The reason
matters and is worth spelling out, because the more obvious design is a trap:

    -- DON'T do this:
    type Effect msg
        = ...
        | Clerk (Clerk.Ports msg -> Cmd msg)

It looks convenient (`Effect.clerk Clerk.signOut` reads nicely), but it does
not admit a correct `map : (a -> msg) -> Effect a -> Effect msg`. `map` needs
to turn a `Clerk.Ports a -> Cmd a` into a `Clerk.Ports msg -> Cmd msg` given
only `toMsg : a -> msg`, which means building a `Clerk.Ports a` out of a
`Clerk.Ports msg`. Both of that record's fields go the wrong way for the
function you have (`Cmd.map` and `Sub.map` need `msg -> a`, not `a -> msg`),
so there is no honest implementation; anything that type-checks either
fabricates a value out of nothing or silently drops the real subscription.

`ClerkAction` sidesteps the problem by carrying no `msg` at all, the same way
Elm Land's own `SendToLocalStorage { key, value }` does. `map` becomes a
no-op for it (nothing to rewrite), and only `toCmd` -- called once, in
`Main.elm`, with the one real `Clerk.Ports Msg` -- ever turns an action into
an actual `Cmd`.

-}

import Clerk


{-| An effect a page or the shell wants to perform, described without
committing to a concrete `Cmd msg` yet.
-}
type Effect msg
    = None
    | Batch (List (Effect msg))
    | SendCmd (Cmd msg)
    | Clerk ClerkAction


{-| Every `elm-clerk` command this example issues, as plain data. Extend this
list alongside `elm-clerk`'s own command API; it is the only place that
needs to change.
-}
type ClerkAction
    = SignOut
    | OpenSignIn
    | OpenSignUp
    | OpenUserProfile
    | MountSignIn String
    | MountUserButton String
    | Unmount String
    | RequestToken { requestId : String, template : Maybe String }
    | SetActiveOrganization String


{-| Do nothing.
-}
none : Effect msg
none =
    None


{-| Run several effects together.
-}
batch : List (Effect msg) -> Effect msg
batch =
    Batch


{-| Lift a plain `Cmd msg` (HTTP requests, `Task.perform`, etc.) into an
`Effect`.
-}
sendCmd : Cmd msg -> Effect msg
sendCmd =
    SendCmd


signOut : Effect msg
signOut =
    Clerk SignOut


openSignIn : Effect msg
openSignIn =
    Clerk OpenSignIn


openSignUp : Effect msg
openSignUp =
    Clerk OpenSignUp


openUserProfile : Effect msg
openUserProfile =
    Clerk OpenUserProfile


mountSignIn : String -> Effect msg
mountSignIn elementId =
    Clerk (MountSignIn elementId)


mountUserButton : String -> Effect msg
mountUserButton elementId =
    Clerk (MountUserButton elementId)


unmount : String -> Effect msg
unmount elementId =
    Clerk (Unmount elementId)


requestToken : { requestId : String, template : Maybe String } -> Effect msg
requestToken args =
    Clerk (RequestToken args)


setActiveOrganization : String -> Effect msg
setActiveOrganization organizationId =
    Clerk (SetActiveOrganization organizationId)


{-| Map the message produced by an effect, the same way `Cmd.map` does.
Needed when a page's `Effect Page.Msg` is embedded into the app's
`Effect Msg`. `Clerk` effects carry no `msg`, so there is nothing to rewrite.
-}
map : (a -> msg) -> Effect a -> Effect msg
map toMsg effect =
    case effect of
        None ->
            None

        Batch effects ->
            Batch (List.map (map toMsg) effects)

        SendCmd cmd ->
            SendCmd (Cmd.map toMsg cmd)

        Clerk action ->
            Clerk action


{-| Turn an `Effect` into the real `Cmd msg` that Elm's runtime needs. Call
this exactly once, at the boundary in `Main.elm`'s `update`, passing the
concrete `Clerk.Ports msg` built from `Ports.clerkOut` / `Ports.clerkIn`.
-}
toCmd : Clerk.Ports msg -> Effect msg -> Cmd msg
toCmd ports effect =
    case effect of
        None ->
            Cmd.none

        Batch effects ->
            Cmd.batch (List.map (toCmd ports) effects)

        SendCmd cmd ->
            cmd

        Clerk action ->
            runClerkAction ports action


runClerkAction : Clerk.Ports msg -> ClerkAction -> Cmd msg
runClerkAction ports action =
    case action of
        SignOut ->
            Clerk.signOut ports

        OpenSignIn ->
            Clerk.openSignIn ports

        OpenSignUp ->
            Clerk.openSignUp ports

        OpenUserProfile ->
            Clerk.openUserProfile ports

        MountSignIn elementId ->
            Clerk.mountSignIn ports elementId

        MountUserButton elementId ->
            Clerk.mountUserButton ports elementId

        Unmount elementId ->
            Clerk.unmount ports elementId

        RequestToken args ->
            Clerk.requestToken ports args

        SetActiveOrganization organizationId ->
            Clerk.setActiveOrganization ports organizationId

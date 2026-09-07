module Main exposing (main)

{-| Minimal `Browser.application` consumer of `elm-clerk`, used as both a
living usage example and the CI Playwright fixture (see `../e2e/smoke.spec.ts`
and `README.md` at the repo root).
-}

import Browser
import Browser.Navigation as Nav
import Clerk
import Effect exposing (Effect)
import Html exposing (Html, button, dd, div, dl, dt, h1, h2, li, p, text, ul)
import Html.Attributes exposing (attribute, id)
import Html.Events exposing (onClick)
import Json.Decode as Decode exposing (Value)
import Ports
import Time
import Url exposing (Url)


type alias Model =
    { key : Nav.Key
    , clerk : Clerk.State
    , token : Maybe String
    , lastError : Maybe String
    , events : List String
    , nextRequestId : Int
    }


type Msg
    = ClerkMsg Clerk.Msg
    | ClickedSignIn
    | ClickedSignOut
    | ClickedGetToken
    | UrlChanged Url
    | LinkClicked Browser.UrlRequest


{-| Built once from the canonical `Ports.elm` and reused everywhere a
`Clerk.Ports msg` is needed: `Clerk.update`, `Clerk.subscriptions`, and
`Effect.toCmd` (which in turn feeds it to every `Clerk.*` command function).
-}
clerkPorts : Clerk.Ports Msg
clerkPorts =
    { toJs = Ports.clerkOut
    , fromJs = Ports.clerkIn
    }


main : Program Value Model Msg
main =
    Browser.application
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        , onUrlRequest = LinkClicked
        , onUrlChange = UrlChanged
        }


init : Value -> Url -> Nav.Key -> ( Model, Cmd Msg )
init flags _ key =
    let
        -- The shim (`attachClerk`) can pass the current Clerk state as the
        -- flag so the very first render is already correct instead of
        -- flashing "loading". If the flag is missing or doesn't decode
        -- (e.g. a bare `{}` during local development without the shim),
        -- fall back to `Clerk.init`, which is always `Loading`.
        clerkState =
            flags
                |> Decode.decodeValue Clerk.stateDecoder
                |> Result.withDefault Clerk.init
    in
    ( { key = key
      , clerk = clerkState
      , token = Nothing
      , lastError = Nothing
      , events = []
      , nextRequestId = 0
      }
    , Cmd.none
    )


subscriptions : Model -> Sub Msg
subscriptions _ =
    Clerk.subscriptions clerkPorts ClerkMsg


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    let
        ( newModel, effect ) =
            updateWithEffect msg model
    in
    ( newModel, Effect.toCmd clerkPorts effect )


updateWithEffect : Msg -> Model -> ( Model, Effect Msg )
updateWithEffect msg model =
    case msg of
        ClerkMsg clerkMsg ->
            let
                ( newState, cmd, event ) =
                    Clerk.update clerkPorts clerkMsg model.clerk

                ( modelWithEvent, effectFromEvent ) =
                    applyEvent event { model | clerk = newState }
            in
            ( modelWithEvent, Effect.batch [ Effect.sendCmd cmd, effectFromEvent ] )

        ClickedSignIn ->
            ( model, Effect.mountSignIn "clerk-sign-in" )

        ClickedSignOut ->
            ( model, Effect.signOut )

        ClickedGetToken ->
            let
                requestId =
                    String.fromInt model.nextRequestId
            in
            ( { model | nextRequestId = model.nextRequestId + 1 }
            , Effect.requestToken { requestId = requestId, template = Nothing }
            )

        UrlChanged _ ->
            ( model, Effect.none )

        LinkClicked urlRequest ->
            case urlRequest of
                Browser.Internal url ->
                    ( model, Effect.sendCmd (Nav.pushUrl model.key (Url.toString url)) )

                Browser.External href ->
                    ( model, Effect.sendCmd (Nav.load href) )


{-| React to the `Maybe Event` every `Clerk.update` call may produce.
Mounting the user button on the transition into `SignedIn` lives here
(a side effect keyed off state change), never in `view`.
-}
applyEvent : Maybe Clerk.Event -> Model -> ( Model, Effect Msg )
applyEvent event model =
    case event of
        Nothing ->
            ( model, Effect.none )

        Just (Clerk.StateChanged (Clerk.SignedIn _)) ->
            ( { model | events = "stateChanged" :: model.events }
            , Effect.mountUserButton "clerk-user-button"
            )

        Just (Clerk.StateChanged _) ->
            ( { model | events = "stateChanged" :: model.events }, Effect.none )

        Just (Clerk.TokenReceived { token }) ->
            ( { model | token = Just token, lastError = Nothing }, Effect.none )

        Just (Clerk.TokenFailed { reason }) ->
            ( { model | lastError = Just reason }, Effect.none )

        Just (Clerk.Error message) ->
            ( { model | lastError = Just message }, Effect.none )


view : Model -> Browser.Document Msg
view model =
    { title = "elm-clerk example"
    , body =
        [ div []
            [ h1 [] [ text "elm-clerk example" ]
            , p []
                [ text "Stable hooks for the Playwright smoke test are the "
                , text "data-testid attributes below."
                ]
            , div [ attribute "data-testid" "state" ] [ text (stateLabel model.clerk) ]
            , viewUserEmail model.clerk
            , viewProfile model.clerk
            , div [ attribute "data-testid" "token" ] [ text (Maybe.withDefault "" model.token) ]
            , div [ attribute "data-testid" "error" ] [ text (Maybe.withDefault "" model.lastError) ]
            , button [ attribute "data-testid" "sign-in", onClick ClickedSignIn ] [ text "Sign in" ]
            , button [ attribute "data-testid" "sign-out", onClick ClickedSignOut ] [ text "Sign out" ]
            , button [ attribute "data-testid" "get-token", onClick ClickedGetToken ] [ text "Get token" ]

            -- Always rendered (never behind an `if`) so `Clerk.mountSignIn`
            -- has somewhere to mount into; ClerkJS then renders its sign-in
            -- UI inline here instead of in a modal overlay.
            , div [ id "clerk-sign-in" ] []
            , div [ id "clerk-user-button" ] []
            ]
        ]
    }


{-| `Loading` must render text of its own: it is the only state before the
first `stateChanged`, and a blank screen there would be indistinguishable
from a broken page.
-}
stateLabel : Clerk.State -> String
stateLabel state =
    case state of
        Clerk.Loading ->
            "loading"

        Clerk.SignedOut ->
            "signedOut"

        Clerk.SignedIn _ ->
            "signedIn"


viewUserEmail : Clerk.State -> Html Msg
viewUserEmail state =
    case state of
        Clerk.SignedIn { user } ->
            div [ attribute "data-testid" "user-email" ]
                [ text (Maybe.withDefault "" user.primaryEmailAddress) ]

        _ ->
            div [ attribute "data-testid" "user-email" ] []


{-| A visual check that the full resource surface arrives: every value here
comes straight out of `Clerk.User`, `Clerk.Session`, and the nested records.
-}
viewProfile : Clerk.State -> Html Msg
viewProfile state =
    case state of
        Clerk.SignedIn { session, user, organization } ->
            div [ attribute "data-testid" "profile" ]
                [ h2 [] [ text "User" ]
                , dl []
                    (List.concatMap row
                        [ ( "id", user.id )
                        , ( "username", orDash user.username )
                        , ( "fullName", orDash user.fullName )
                        , ( "hasImage", bool user.hasImage )
                        , ( "passwordEnabled", bool user.passwordEnabled )
                        , ( "twoFactorEnabled", bool user.twoFactorEnabled )
                        , ( "lastSignInAt", maybeTime user.lastSignInAt )
                        , ( "createdAt", maybeTime user.createdAt )
                        ]
                    )
                , h2 [] [ text "Email addresses" ]
                , ul [ attribute "data-testid" "email-addresses" ]
                    (List.map
                        (\email ->
                            li []
                                [ text email.emailAddress
                                , text " ("
                                , text (orDash email.verification.status)
                                , text ")"
                                ]
                        )
                        user.emailAddresses
                    )
                , h2 [] [ text "Organization memberships" ]
                , ul [ attribute "data-testid" "memberships" ]
                    (List.map
                        (\membership ->
                            li []
                                [ text membership.organization.name
                                , text ": "
                                , text membership.roleName
                                , text " ("
                                , text (String.fromInt (List.length membership.permissions))
                                , text " permissions)"
                                ]
                        )
                        user.organizationMemberships
                    )
                , h2 [] [ text "Session" ]
                , dl []
                    (List.concatMap row
                        [ ( "id", session.id )
                        , ( "status", session.status )
                        , ( "expireAt", time session.expireAt )
                        , ( "lastActiveOrganizationId", orDash session.lastActiveOrganizationId )
                        , ( "tasks", String.join ", " session.tasks )
                        , ( "identifier", session.publicUserData.identifier )
                        ]
                    )
                , h2 [] [ text "Active organization" ]
                , div [ attribute "data-testid" "organization" ]
                    [ text
                        (organization
                            |> Maybe.map (\org -> org.name ++ " (" ++ String.fromInt org.membersCount ++ " members)")
                            |> Maybe.withDefault "none"
                        )
                    ]
                ]

        _ ->
            div [ attribute "data-testid" "profile" ] []


row : ( String, String ) -> List (Html Msg)
row ( label, value ) =
    [ dt [] [ text label ], dd [ attribute "data-field" label ] [ text value ] ]


orDash : Maybe String -> String
orDash =
    Maybe.withDefault "-"


bool : Bool -> String
bool value =
    if value then
        "yes"

    else
        "no"


time : Time.Posix -> String
time posix =
    String.fromInt (Time.posixToMillis posix)


maybeTime : Maybe Time.Posix -> String
maybeTime =
    Maybe.map time >> Maybe.withDefault "-"

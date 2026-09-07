module UpdateTest exposing (suite)

import Clerk
import Clerk.Internal.Protocol as Protocol
import Expect
import Fixtures
import Json.Decode as Decode
import Json.Encode as Encode
import Test exposing (Test, describe, test)


ports : Clerk.Ports ()
ports =
    { toJs = \_ -> Cmd.none
    , fromJs = \_ -> Sub.none
    }


{-| Feed one raw JSON message through `Clerk.update`, dropping the command,
which is always `Cmd.none` and cannot be compared.
-}
run : Clerk.State -> String -> ( Clerk.State, Maybe Clerk.Event )
run state raw =
    let
        value : Encode.Value
        value =
            Decode.decodeString Decode.value raw
                |> Result.withDefault (Encode.string raw)

        ( newState, _, event ) =
            Clerk.update ports (Protocol.Incoming value) state
    in
    ( newState, event )


isError : Clerk.Event -> Bool
isError event =
    case event of
        Clerk.Error _ ->
            True

        _ ->
            False


suite : Test
suite =
    describe "update"
        [ test "init is Loading" <|
            \_ -> Clerk.init |> Expect.equal Clerk.Loading
        , test "stateChanged replaces the state and reports it" <|
            \_ ->
                run Clerk.Loading """{"v":1,"tag":"stateChanged","state":{"status":"signedOut"}}"""
                    |> Expect.equal ( Clerk.SignedOut, Just (Clerk.StateChanged Clerk.SignedOut) )
        , test "a signedIn state carries the resources" <|
            \_ ->
                run Clerk.Loading ("""{"v":1,"tag":"stateChanged","state":""" ++ Fixtures.emptyJson ++ "}")
                    |> Tuple.first
                    |> (\state ->
                            case state of
                                Clerk.SignedIn { session, user, organization } ->
                                    ( session.id, user.id, organization )

                                _ ->
                                    ( "wrong", "state", Nothing )
                       )
                    |> Expect.equal ( "sess_2", "user_2", Nothing )
        , test "tokenReceived passes through without changing the state" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"tokenReceived","requestId":"req-1","token":"jwt"}"""
                    |> Expect.equal
                        ( Clerk.SignedOut
                        , Just (Clerk.TokenReceived { requestId = "req-1", token = "jwt" })
                        )
        , test "tokenFailed passes through without changing the state" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"tokenFailed","requestId":"req-1","reason":"no session"}"""
                    |> Expect.equal
                        ( Clerk.SignedOut
                        , Just (Clerk.TokenFailed { requestId = "req-1", reason = "no session" })
                        )
        , test "error passes through without changing the state" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"error","message":"boom"}"""
                    |> Expect.equal ( Clerk.SignedOut, Just (Clerk.Error "boom") )
        , test "an unknown tag becomes an Error event" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"teleport"}"""
                    |> Expect.equal ( Clerk.SignedOut, Just (Clerk.Error "unknown tag: teleport") )
        , test "a wrong protocol version becomes an Error event" <|
            \_ ->
                run Clerk.SignedOut """{"v":2,"tag":"error","message":"boom"}"""
                    |> Expect.equal
                        ( Clerk.SignedOut
                        , Just (Clerk.Error "unsupported protocol version: 2 (expected 1)")
                        )
        , test "an undecodable payload becomes an Error event without crashing" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"tokenReceived","requestId":"req-1"}"""
                    |> Expect.all
                        [ Tuple.first >> Expect.equal Clerk.SignedOut
                        , Tuple.second >> Maybe.map isError >> Expect.equal (Just True)
                        ]
        , test "a message that is not an object becomes an Error event" <|
            \_ ->
                run Clerk.Loading "\"nonsense\""
                    |> Tuple.second
                    |> Maybe.map isError
                    |> Expect.equal (Just True)
        , test "a stateChanged carrying an unknown status becomes an Error event" <|
            \_ ->
                run Clerk.SignedOut """{"v":1,"tag":"stateChanged","state":{"status":"pending"}}"""
                    |> Expect.all
                        [ Tuple.first >> Expect.equal Clerk.SignedOut
                        , Tuple.second >> Maybe.map isError >> Expect.equal (Just True)
                        ]
        ]

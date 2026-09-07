module UpdateTest exposing (suite)

import Clerk
import Clerk.Internal.Protocol as Protocol
import Expect
import Json.Decode as Decode
import Json.Encode as Encode
import Test exposing (Test, describe, test)
import Time


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


signedInJson : String
signedInJson =
    """{"status":"signedIn","session":{"id":"sess_1","status":"active","lastActiveAt":1700000000000,"expireAt":1700003600000},"user":{"id":"user_1","primaryEmailAddress":"ada@example.com","firstName":"Ada","lastName":"Lovelace","imageUrl":"i","createdAt":null},"organization":null}"""


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
                run Clerk.Loading ("""{"v":1,"tag":"stateChanged","state":""" ++ signedInJson ++ "}")
                    |> Tuple.first
                    |> Expect.equal
                        (Clerk.SignedIn
                            { session =
                                { id = "sess_1"
                                , status = "active"
                                , lastActiveAt = Time.millisToPosix 1700000000000
                                , expireAt = Time.millisToPosix 1700003600000
                                }
                            , user =
                                { id = "user_1"
                                , primaryEmailAddress = Just "ada@example.com"
                                , firstName = Just "Ada"
                                , lastName = Just "Lovelace"
                                , imageUrl = "i"
                                , createdAt = Nothing
                                }
                            , organization = Nothing
                            }
                        )
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

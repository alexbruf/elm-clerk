module DecodeTest exposing (suite)

import Clerk
import Clerk.Internal.Protocol as Protocol
import Clerk.Organization
import Clerk.Session
import Clerk.User
import Expect
import Json.Decode as Decode
import Test exposing (Test, describe, test)
import Time


userJson : String
userJson =
    """{"id":"user_1","primaryEmailAddress":"ada@example.com","firstName":"Ada","lastName":"Lovelace","imageUrl":"https://img.clerk.com/ada","createdAt":1700000000000}"""


sessionJson : String
sessionJson =
    """{"id":"sess_1","status":"active","lastActiveAt":1700000000000,"expireAt":1700003600000}"""


organizationJson : String
organizationJson =
    """{"id":"org_1","name":"Acme","slug":"acme","imageUrl":"https://img.clerk.com/acme"}"""


signedInJson : String -> String
signedInJson organization =
    """{"status":"signedIn","session":"""
        ++ sessionJson
        ++ ""","user":"""
        ++ userJson
        ++ ""","organization":"""
        ++ organization
        ++ "}"


incoming : String -> Result Decode.Error (Protocol.Incoming Clerk.State)
incoming =
    Decode.decodeString (Protocol.decoder Clerk.stateDecoder)


errorMessage : Protocol.Incoming Clerk.State -> String
errorMessage message =
    case message of
        Protocol.ProtocolError text ->
            text

        _ ->
            "not a ProtocolError"


suite : Test
suite =
    describe "decoding"
        [ describe "resources"
            [ test "user" <|
                \_ ->
                    Decode.decodeString Clerk.User.decoder userJson
                        |> Expect.equal
                            (Ok
                                { id = "user_1"
                                , primaryEmailAddress = Just "ada@example.com"
                                , firstName = Just "Ada"
                                , lastName = Just "Lovelace"
                                , imageUrl = "https://img.clerk.com/ada"
                                , createdAt = Just (Time.millisToPosix 1700000000000)
                                }
                            )
            , test "user with every nullable field null" <|
                \_ ->
                    Decode.decodeString Clerk.User.decoder
                        """{"id":"user_2","primaryEmailAddress":null,"firstName":null,"lastName":null,"imageUrl":"https://img.clerk.com/anon","createdAt":null}"""
                        |> Expect.equal
                            (Ok
                                { id = "user_2"
                                , primaryEmailAddress = Nothing
                                , firstName = Nothing
                                , lastName = Nothing
                                , imageUrl = "https://img.clerk.com/anon"
                                , createdAt = Nothing
                                }
                            )
            , test "user ignores fields outside the manifest" <|
                \_ ->
                    Decode.decodeString Clerk.User.decoder
                        """{"id":"user_3","primaryEmailAddress":null,"firstName":null,"lastName":null,"imageUrl":"i","createdAt":null,"username":"ada"}"""
                        |> Result.map .id
                        |> Expect.equal (Ok "user_3")
            , test "session" <|
                \_ ->
                    Decode.decodeString Clerk.Session.decoder sessionJson
                        |> Expect.equal
                            (Ok
                                { id = "sess_1"
                                , status = "active"
                                , lastActiveAt = Time.millisToPosix 1700000000000
                                , expireAt = Time.millisToPosix 1700003600000
                                }
                            )
            , test "timestamps arriving as floats are rounded to milliseconds" <|
                \_ ->
                    Decode.decodeString Clerk.Session.decoder
                        """{"id":"sess_2","status":"active","lastActiveAt":1700000000000.6,"expireAt":1700003600000.0}"""
                        |> Result.map .lastActiveAt
                        |> Expect.equal (Ok (Time.millisToPosix 1700000000001))
            , test "organization" <|
                \_ ->
                    Decode.decodeString Clerk.Organization.decoder organizationJson
                        |> Expect.equal
                            (Ok
                                { id = "org_1"
                                , name = "Acme"
                                , slug = Just "acme"
                                , imageUrl = "https://img.clerk.com/acme"
                                }
                            )
            , test "organization with a null slug" <|
                \_ ->
                    Decode.decodeString Clerk.Organization.decoder
                        """{"id":"org_2","name":"Acme","slug":null,"imageUrl":"i"}"""
                        |> Result.map .slug
                        |> Expect.equal (Ok Nothing)
            ]
        , describe "stateDecoder"
            [ test "loading" <|
                \_ ->
                    Decode.decodeString Clerk.stateDecoder """{"status":"loading"}"""
                        |> Expect.equal (Ok Clerk.Loading)
            , test "signedOut" <|
                \_ ->
                    Decode.decodeString Clerk.stateDecoder """{"status":"signedOut"}"""
                        |> Expect.equal (Ok Clerk.SignedOut)
            , test "signedIn with an organization" <|
                \_ ->
                    Decode.decodeString Clerk.stateDecoder (signedInJson organizationJson)
                        |> Expect.equal
                            (Ok
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
                                        , imageUrl = "https://img.clerk.com/ada"
                                        , createdAt = Just (Time.millisToPosix 1700000000000)
                                        }
                                    , organization =
                                        Just
                                            { id = "org_1"
                                            , name = "Acme"
                                            , slug = Just "acme"
                                            , imageUrl = "https://img.clerk.com/acme"
                                            }
                                    }
                                )
                            )
            , test "signedIn without an organization" <|
                \_ ->
                    Decode.decodeString Clerk.stateDecoder (signedInJson "null")
                        |> Result.map
                            (\state ->
                                case state of
                                    Clerk.SignedIn signedIn ->
                                        signedIn.organization

                                    _ ->
                                        Nothing
                            )
                        |> Expect.equal (Ok Nothing)
            , test "an unknown status fails" <|
                \_ ->
                    Decode.decodeString Clerk.stateDecoder """{"status":"pending"}"""
                        |> Expect.err
            ]
        , describe "incoming messages"
            [ test "stateChanged" <|
                \_ ->
                    incoming """{"v":1,"tag":"stateChanged","state":{"status":"signedOut"}}"""
                        |> Expect.equal (Ok (Protocol.StateChanged Clerk.SignedOut))
            , test "tokenReceived" <|
                \_ ->
                    incoming """{"v":1,"tag":"tokenReceived","requestId":"req-1","token":"jwt"}"""
                        |> Expect.equal (Ok (Protocol.TokenReceived { requestId = "req-1", token = "jwt" }))
            , test "tokenFailed" <|
                \_ ->
                    incoming """{"v":1,"tag":"tokenFailed","requestId":"req-1","reason":"no session"}"""
                        |> Expect.equal (Ok (Protocol.TokenFailed { requestId = "req-1", reason = "no session" }))
            , test "error" <|
                \_ ->
                    incoming """{"v":1,"tag":"error","message":"boom"}"""
                        |> Expect.equal (Ok (Protocol.ProtocolError "boom"))
            , test "an unknown tag becomes a ProtocolError naming the tag" <|
                \_ ->
                    incoming """{"v":1,"tag":"teleport"}"""
                        |> Result.map errorMessage
                        |> Expect.equal (Ok "unknown tag: teleport")
            , test "a wrong protocol version becomes a ProtocolError" <|
                \_ ->
                    incoming """{"v":2,"tag":"stateChanged","state":{"status":"signedOut"}}"""
                        |> Result.map errorMessage
                        |> Expect.equal (Ok "unsupported protocol version: 2 (expected 1)")
            , test "a missing v fails to decode" <|
                \_ ->
                    incoming """{"tag":"stateChanged","state":{"status":"signedOut"}}"""
                        |> Expect.err
            , test "a malformed payload fails to decode" <|
                \_ ->
                    incoming """{"v":1,"tag":"tokenReceived","requestId":"req-1"}"""
                        |> Expect.err
            ]
        ]

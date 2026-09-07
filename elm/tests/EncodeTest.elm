module EncodeTest exposing (suite)

import Clerk.Internal.Protocol as Protocol
import Expect
import Json.Encode as Encode
import Test exposing (Test, describe, test)


json : Encode.Value -> String
json =
    Encode.encode 0


suite : Test
suite =
    describe "outgoing messages"
        [ test "signOut" <|
            \_ ->
                json Protocol.signOut
                    |> Expect.equal """{"v":1,"tag":"signOut"}"""
        , test "openSignIn" <|
            \_ ->
                json Protocol.openSignIn
                    |> Expect.equal """{"v":1,"tag":"openSignIn"}"""
        , test "openSignUp" <|
            \_ ->
                json Protocol.openSignUp
                    |> Expect.equal """{"v":1,"tag":"openSignUp"}"""
        , test "openUserProfile" <|
            \_ ->
                json Protocol.openUserProfile
                    |> Expect.equal """{"v":1,"tag":"openUserProfile"}"""
        , test "mountSignIn" <|
            \_ ->
                json (Protocol.mountSignIn "sign-in")
                    |> Expect.equal """{"v":1,"tag":"mountSignIn","elementId":"sign-in"}"""
        , test "mountUserButton" <|
            \_ ->
                json (Protocol.mountUserButton "user-button")
                    |> Expect.equal """{"v":1,"tag":"mountUserButton","elementId":"user-button"}"""
        , test "unmount" <|
            \_ ->
                json (Protocol.unmount "sign-in")
                    |> Expect.equal """{"v":1,"tag":"unmount","elementId":"sign-in"}"""
        , test "requestToken with a template" <|
            \_ ->
                json (Protocol.requestToken { requestId = "req-1", template = Just "backend" })
                    |> Expect.equal """{"v":1,"tag":"requestToken","requestId":"req-1","template":"backend"}"""
        , test "requestToken without a template sends null" <|
            \_ ->
                json (Protocol.requestToken { requestId = "req-2", template = Nothing })
                    |> Expect.equal """{"v":1,"tag":"requestToken","requestId":"req-2","template":null}"""
        , test "setActiveOrganization" <|
            \_ ->
                json (Protocol.setActiveOrganization "org_1")
                    |> Expect.equal """{"v":1,"tag":"setActiveOrganization","organizationId":"org_1"}"""
        , test "every message carries the protocol version" <|
            \_ ->
                Protocol.protocolVersion |> Expect.equal 1
        ]

module DecodeTest exposing (suite)

import Clerk
import Clerk.Actor
import Clerk.Internal.Protocol as Protocol
import Clerk.Organization exposing (Organization)
import Clerk.Session exposing (Session)
import Clerk.User exposing (User)
import Clerk.Verification
import Expect
import Fixtures
import Json.Decode as Decode
import Json.Encode as Encode
import Test exposing (Test, describe, test)
import Time


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


type alias SignedIn =
    { session : Session, user : User, organization : Maybe Organization }


signedIn : String -> Result String SignedIn
signedIn json =
    case Decode.decodeString Clerk.stateDecoder json of
        Ok (Clerk.SignedIn record) ->
            Ok record

        Ok _ ->
            Err "not SignedIn"

        Err err ->
            Err (Decode.errorToString err)


full : Result String SignedIn
full =
    signedIn Fixtures.fullJson


empty : Result String SignedIn
empty =
    signedIn Fixtures.emptyJson


posix : Int -> Time.Posix
posix =
    Time.millisToPosix


suite : Test
suite =
    describe "decoding"
        [ describe "fixtures/full.json (every field populated)"
            [ test "decodes" <|
                \_ -> full |> Result.map (always ()) |> Expect.equal (Ok ())
            , test "user scalars" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ user } ->
                                ( ( user.id, user.externalId, user.username )
                                , ( user.fullName, user.primaryEmailAddress, user.primaryPhoneNumber )
                                , ( user.primaryWeb3Wallet, user.hasImage, user.twoFactorEnabled )
                                )
                            )
                        |> Expect.equal
                            (Ok
                                ( ( "user_1", Just "ext_1", Just "ada" )
                                , ( Just "Ada Lovelace", Just "ada@example.com", Just "+15555550100" )
                                , ( Just "0xabc123", True, True )
                                )
                            )
            , test "user timestamps" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> ( user.lastSignInAt, user.legalAcceptedAt, ( user.createdAt, user.updatedAt ) ))
                        |> Expect.equal
                            (Ok
                                ( Just (posix 1757239200000)
                                , Just (posix 1757152800000)
                                , ( Just (posix 1757152800000), Just (posix 1757239200000) )
                                )
                            )
            , test "user metadata passes through as JSON" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> ( Encode.encode 0 user.publicMetadata, Encode.encode 0 user.unsafeMetadata ))
                        |> Expect.equal (Ok ( """{"role":"founder"}""", """{"theme":"dark"}""" ))
            , test "user nested lists" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ user } ->
                                [ List.length user.emailAddresses
                                , List.length user.phoneNumbers
                                , List.length user.web3Wallets
                                , List.length user.externalAccounts
                                , List.length user.enterpriseAccounts
                                , List.length user.passkeys
                                , List.length user.organizationMemberships
                                ]
                            )
                        |> Expect.equal (Ok [ 1, 1, 1, 1, 1, 1, 1 ])
            , test "email address with verification and linkedTo" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> List.head user.emailAddresses)
                        |> Result.map
                            (Maybe.map
                                (\email ->
                                    ( ( email.emailAddress, email.matchesSsoConnection )
                                    , ( email.verification.status, email.verification.expireAt, email.verification.verifiedAtClient )
                                    , List.map (\link -> ( link.id, link.type_ )) email.linkedTo
                                    )
                                )
                            )
                        |> Expect.equal
                            (Ok
                                (Just
                                    ( ( "ada@example.com", False )
                                    , ( Just "verified", Just (posix 1757239800000), Just "client_1" )
                                    , [ ( "idn_oauth_1", "oauth_google" ) ]
                                    )
                                )
                            )
            , test "phone number backup codes" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> List.head user.phoneNumbers |> Maybe.map (\p -> ( p.reservedForSecondFactor, p.backupCodes )))
                        |> Expect.equal (Ok (Just ( True, [ "code-1", "code-2" ] )))
            , test "web3 wallet verification error and nonce" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> List.head user.web3Wallets |> Maybe.map (\w -> ( w.web3Wallet, w.verification.error, w.verification.nonce )))
                        |> Expect.equal (Ok (Just ( "0xabc123", Just "signature rejected", Just "nonce-1" )))
            , test "external account redirect URL and metadata" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ user } ->
                                List.head user.externalAccounts
                                    |> Maybe.map
                                        (\a ->
                                            ( ( a.provider, a.username, a.phoneNumber )
                                            , Maybe.andThen .externalVerificationRedirectURL a.verification
                                            , Encode.encode 0 a.publicMetadata
                                            )
                                        )
                            )
                        |> Expect.equal
                            (Ok
                                (Just
                                    ( ( "google", Just "ada.lovelace", Nothing )
                                    , Just "https://accounts.google.com/o/oauth2/auth?x=1"
                                    , """{"tier":"gold"}"""
                                    )
                                )
                            )
            , test "enterprise account with nested connection" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ user } ->
                                List.head user.enterpriseAccounts
                                    |> Maybe.map
                                        (\e ->
                                            ( ( e.id, e.protocol, e.lastAuthenticatedAt )
                                            , Maybe.map (\c -> ( c.domain, c.allowSubdomains, c.logoPublicUrl )) e.enterpriseConnection
                                            )
                                        )
                            )
                        |> Expect.equal
                            (Ok
                                (Just
                                    ( ( Just "ea_1", "saml", Just (posix 1757239200000) )
                                    , Just ( "acme.com", True, Just "https://img.clerk.com/acme-logo" )
                                    )
                                )
                            )
            , test "passkey" <|
                \_ ->
                    full
                        |> Result.map (\{ user } -> List.head user.passkeys |> Maybe.map (\p -> ( p.name, p.lastUsedAt, Maybe.andThen .strategy p.verification )))
                        |> Expect.equal (Ok (Just ( Just "MacBook Touch ID", Just (posix 1757239200000), Just "passkey" )))
            , test "organization membership with nested organization and public user data" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ user } ->
                                List.head user.organizationMemberships
                                    |> Maybe.map
                                        (\m ->
                                            ( ( m.role, m.roleName, m.permissions )
                                            , ( m.organization.id, m.organization.membersCount )
                                            , Maybe.map .username m.publicUserData
                                            )
                                        )
                            )
                        |> Expect.equal
                            (Ok
                                (Just
                                    ( ( "org:admin", "Admin", [ "org:sys_profile:manage", "org:sys_memberships:read" ] )
                                    , ( "org_1", 12 )
                                    , Just (Just "ada")
                                    )
                                )
                            )
            , test "session" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ session } ->
                                ( ( session.id, session.status, session.lastActiveOrganizationId )
                                , ( session.factorVerificationAge, session.tasks, session.currentTask )
                                , ( Maybe.map (\a -> ( a.sub, a.type_ )) session.actor, session.publicUserData.identifier, session.abandonAt )
                                )
                            )
                        |> Expect.equal
                            (Ok
                                ( ( "sess_1", "active", Just "org_1" )
                                , ( Just { firstFactorAge = 5, secondFactorAge = -1 }, [ "choose-organization" ], Just "choose-organization" )
                                , ( Just ( "user_admin", Just "admin" ), "ada@example.com", posix 1759917600000 )
                                )
                            )
            , test "organization" <|
                \_ ->
                    full
                        |> Result.map
                            (\{ organization } ->
                                Maybe.map
                                    (\o -> ( ( o.name, o.slug, o.pendingInvitationsCount ), ( o.adminDeleteEnabled, o.maxAllowedMemberships, o.updatedAt ) ))
                                    organization
                            )
                        |> Expect.equal (Ok (Just ( ( "ViewEngine", Just "viewengine", 3 ), ( True, 25, posix 1757239200000 ) )))
            ]
        , describe "fixtures/empty.json (every nullable null, every list empty)"
            [ test "decodes" <|
                \_ -> empty |> Result.map (always ()) |> Expect.equal (Ok ())
            , test "user nullables are Nothing and lists are empty" <|
                \_ ->
                    empty
                        |> Result.map
                            (\{ user } ->
                                ( [ user.externalId, user.username, user.fullName, user.firstName, user.lastName, user.primaryEmailAddress, user.primaryEmailAddressId ]
                                , [ user.lastSignInAt, user.legalAcceptedAt, user.createdAt, user.updatedAt ]
                                , ( List.isEmpty user.emailAddresses && List.isEmpty user.organizationMemberships, Encode.encode 0 user.publicMetadata )
                                )
                            )
                        |> Expect.equal (Ok ( List.repeat 7 Nothing, List.repeat 4 Nothing, ( True, "{}" ) ))
            , test "session nullables" <|
                \_ ->
                    empty
                        |> Result.map (\{ session } -> ( session.factorVerificationAge, session.actor, ( session.tasks, session.currentTask, session.publicUserData.banned ) ))
                        |> Expect.equal (Ok ( Nothing, Nothing, ( [], Nothing, False ) ))
            , test "organization is Nothing" <|
                \_ ->
                    empty |> Result.map .organization |> Expect.equal (Ok Nothing)
            ]
        , describe "resource decoder details"
            [ test "timestamps arriving as floats are rounded to milliseconds" <|
                \_ ->
                    Decode.decodeString Clerk.Verification.decoder
                        """{"status":null,"strategy":null,"expireAt":1700000000000.6,"error":null,"message":null,"nonce":null,"externalVerificationRedirectURL":null,"verifiedAtClient":null}"""
                        |> Result.map .expireAt
                        |> Expect.equal (Ok (Just (posix 1700000000001)))
            , test "fields outside the manifest are ignored" <|
                \_ ->
                    Decode.decodeString Clerk.Actor.decoder """{"sub":"user_x","type":null,"iss":"clerk"}"""
                        |> Expect.equal (Ok { sub = "user_x", type_ = Nothing })
            , test "a missing manifest field fails" <|
                \_ ->
                    Decode.decodeString Clerk.Actor.decoder """{"sub":"user_x"}"""
                        |> Expect.err
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
            , test "stateChanged carrying the full fixture" <|
                \_ ->
                    incoming ("""{"v":1,"tag":"stateChanged","state":""" ++ Fixtures.fullJson ++ "}")
                        |> Result.map
                            (\message ->
                                case message of
                                    Protocol.StateChanged (Clerk.SignedIn record) ->
                                        record.user.id

                                    _ ->
                                        "wrong message"
                            )
                        |> Expect.equal (Ok "user_1")
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

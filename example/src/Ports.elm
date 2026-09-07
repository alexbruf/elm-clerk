port module Ports exposing (clerkIn, clerkOut)

import Json.Encode exposing (Value)

port clerkOut : Value -> Cmd msg
port clerkIn : (Value -> msg) -> Sub msg

rule listen: medium {
  meta:
    description = "create a pair of connected sockets"

  strings:
    $socket = "socketpair" fullword

  condition:
    any of them
}
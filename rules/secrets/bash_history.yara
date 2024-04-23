rule bash_history : suspicious {
  meta:
	description = "access .bash_history file"
  strings:
	$ref = ".bash_history" fullword
  condition:
    all of them
}
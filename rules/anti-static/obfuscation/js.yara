import "math"

private rule probably_js {
  strings:
    $f_function = /function\(\w{0,8}\)/
    $f_const    = "const" fullword
    $f_return   = "return" fullword
    $f_var      = "var" fullword

  condition:
    filesize < 512KB and all of ($f*)
}

rule character_obfuscation: medium {
  meta:
    description = "obfuscated javascript that relies on character manipulation"
    filetypes   = "javascript"

  strings:
    $a_char         = "charCodeAt"
    $a_charAt       = "charAt"
    $a_toString     = "toString"
    $a_length       = "length"
    $a_fromCharCode = "fromCharCode"
    $a_shift        = "shift"
    $a_push         = "push"

    $const    = "const "
    $function = "function("
    $return   = "{return"

  condition:
    filesize < 4MB and all of them
}

rule js_char_code_at_substitution: high {
  meta:
    description = "converts integers into strings and contains a substitution map"
    filetypes   = "javascript"

  strings:
    $charCodeAt = "charCodeAt" fullword
    $index      = "fghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345"

  condition:
    filesize < 256KB and all of them
}

rule child_process: critical {
  meta:
    description = "obfuscated javascript that calls external programs"

  strings:
    $f_const         = "const" fullword
    $f_return        = "return" fullword
    $f_var           = "var" fullword
    $o_child_process = "child_process"
    $o_decode        = "decode("
    $o_tostring      = "toString("
    $o_from          = ".from("
    $wtf_hex         = /\w{4,16}\<\-0x\d{2,4}/

  condition:
    filesize < 1MB and all of them and math.entropy(1, filesize) >= 6
}

rule ebe: critical {
  meta:
    description = "highly obfuscated javascript (eBe)"
    filetypes   = "javascript"

  strings:
    $function   = "function("
    $charCodeAt = "charCodeAt"

    $ref = /eBe\(-\d{1,3}\)/

  condition:
    filesize < 5MB and $function and $charCodeAt and #ref > 10
}

rule ebe_generic: high {
  meta:
    description = "highly obfuscated javascript"
    filetypes   = "javascript"

  strings:
    $function   = "function("
    $charCodeAt = "charCodeAt"

    $ref  = /\w\[\w{1,3}\(\d{1,3}\)\]=\w{1,3}\(\d{1,3}\),e\[\w{1,3}\(\d{1,3}\)\]/
    $ref2 = /\w\[\w{1,3}\(\d{1,3}\)\]\&\w{1,3}\(\d{1,3}\)\),\w\[\w{1,3}\(\d{1,3}\)\]/
    $ref3 = /\>\w{1,3}\(\d{1,3}\)\);\w\[\w{1,3}\(\d{1,3}\)\]\=/

  condition:
    filesize < 5MB and #function and $charCodeAt and (#ref > 5 or #ref2 > 5 or #ref3 > 5)
}

rule exec_console_log: critical {
  meta:
    description            = "evaluates the return of console.log()"
    hash_2017_package_post = "7664e04586d294092c86b7203f0651d071a993c5d62875988c2c5474e554c0e8"

  strings:
    $ref = ".exec(console.log("

  condition:
    any of them
}

rule js_const_func_obfuscation: medium {
  meta:
    description = "javascript obfuscation (excessive const functions)"

  strings:
    $const    = "const "
    $function = "function("
    $return   = "{return"

  condition:
    filesize < 256KB and #const > 32 and #function > 48 and #return > 64
}

rule js_hex_eval_obfuscation: critical {
  meta:
    description = "javascript eval bfuscation (hex)"

  strings:
    $return = /\(eval, _{0,4}0x[\w]{0,32}[\(\[]/

  condition:
    filesize < 128KB and any of them
}

rule js_hex_obfuscation: critical {
  meta:
    description = "javascript function obfuscation (hex)"

  strings:
    $return = /return _{0,4}0x[\w]{0,32}\(_0x[\w]{0,32}/
    $const  = /const _{0,4}0x[\w]{0,32}=[\w]{0,32}/

  condition:
    filesize < 1MB and any of them
}

rule high_entropy: medium {
  meta:
    description = "high entropy javascript (>5.37)"

  condition:
    probably_js and math.entropy(1, filesize) >= 5.37
}

rule very_high_entropy: critical {
  meta:
    description = "very high entropy javascript (>7)"

  condition:
    probably_js and math.entropy(1, filesize) >= 7
}

rule js_char_code_at: medium {
  meta:
    description = "converts strings into integers"
    filetypes   = "javascript"

  strings:
    $charCodeAt = "fromCharCode" fullword

  condition:
    filesize < 16KB and any of them
}

rule charCodeAtIncrement: high {
  meta:
    description = "converts incremented numbers into characters"
    filetypes   = "javascript"

  strings:
    $function  = "function("
    $increment = /charCodeAt\(\+\+\w{0,4}\)/

  condition:
    filesize < 4MB and $function and #increment > 1
}

rule js_many_parseInt: high {
  meta:
    description = "javascript obfuscation (integer parsing)"
    filetypes   = "javascript"

  strings:
    $const    = "const "
    $function = "function("
    $return   = "{return"
    $parseInt = "parseInt"

  condition:
    filesize < 256KB and #const > 16 and #function > 32 and #parseInt > 8 and #return > 32
}

rule over_powered_arrays: high {
  meta:
    description = "uses many powered array elements (>25)"
    filetypes   = "javascript"

  strings:
    $function    = /function\(\w,/
    $charAt      = /charAt\([a-zA-Z]/
    $power_array = /\w\[\d{1,4}\]\^\w\[\d{1,4}\]/

  condition:
    filesize < 5MB and $function and $charAt and #power_array > 25
}
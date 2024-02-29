
rule opaque_elf_binary : critical {
  meta:
    hash_2023_Linux_Malware_Samples_060b = "060b01f15c7fab6c4f656aa1f120ebc1221a71bca3177f50083db0ed77596f0f"
    hash_2023_Linux_Malware_Samples_06ed = "06ed8158a168fa9635ed8d79679587f45cfd9825859e346361443eda0fc40b4c"
    hash_2023_Linux_Malware_Samples_0d9a = "0d9a34fd35ea6aa090c93f6f8310e111f9276bacbdf5f14e5f1f8c1dc7bf3ce5"
    hash_2023_Linux_Malware_Samples_0e49 = "0e492a3be57312e9b53ea378fa09650191ddb4aee0eed96dfc71567863b500a8"
    hash_2023_Linux_Malware_Samples_0f78 = "0f7838d0c16c24cb3b8ffc3573cc94fd05ec0e63fada3d10ac02b9c8bd95127b"
    hash_2023_Linux_Malware_Samples_1099 = "10995106e8810a432ebc487fafcb7e421100eb8ac60031e6d27c8770f6686b4e"
    hash_2023_Linux_Malware_Samples_14a3 = "14a33415e95d104cf5cf1acaff9586f78f7ec3ffb26efd0683c468edeaf98fd7"
    hash_2023_Linux_Malware_Samples_16e0 = "16e09592a9e85cd67530ec365ac2c50e48e873335c1ad0f984e3daaefc8a57b5"
	description = "Opaque ELF binary (few words)"
  strings:
    $word_with_spaces = /[a-z\-]{2,} [a-z]{2,}/
	$gmon_start = "__gmon_start__"
	$usage = "usage:" fullword
  condition:
    uint32(0) == 1179403647 and filesize < 10485760 and #word_with_spaces < 3 and not $gmon_start and not $usage
}

rule opaque_macho_binary : suspicious {
  meta:
    hash_2023_MacOS_applet = "54db4cc34db4975a60c919cd79bb01f9e0c3e8cf89571fee09c75dfff77a0bcd"
    hash_2021_CDDS_arch = "a63466d09c3a6a2596a98de36083b6d268f393a27f7b781e52eeb98ae055af97"
    hash_2019_Macma_CDDS_at = "341bc86bc9b76ac69dca0a48a328fd37d74c96c2e37210304cfa66ccdbe72b27"
    hash_2018_org_logind_ctp_archive_helper = "562c420921f5146273b513d17b9f470a99bd676e574c155376c3eb19c37baa09"
    hash_2018_org_logind_ctp_archive = "02e4d0e23391bbbb75c47f5db44d119176803da74b1c170250e848de51632ae9"
    hash_2017_MacOS_logind = "1cf36a2d8a2206cb4758dcdbd0274f21e6f437079ea39772e821a32a76271d46"
    hash_2017_FlashBack = "8d56d09650ebc019209a788b2d2be7c7c8b865780eee53856bafceffaf71502c"
    hash_1980_FruitFly_A_a94d = "a94dd8bfca34fd6ca3a475d6be342d236b39fbf0c2ab90b2edff62bcdbbe5d37"
  strings:
    $word_with_spaces = /[a-z]{2,} [a-z]{2,}/
  condition:
    filesize < 52428800 and (uint32(0) == 4277009102 or uint32(0) == 3472551422 or uint32(0) == 4277009103 or uint32(0) == 3489328638 or uint32(0) == 3405691582 or uint32(0) == 3199925962) and #word_with_spaces < 4
}